const fs = require('fs');
const path = require('path');
const { assert } = require('chai');
const postcss = require('postcss');
const short = require('postcss-merge-longhand');
const cheerio = require('cheerio');
const R = require('ramda');

const source_html = fs.readFileSync(path.join(process.cwd(), 'index.html'), 'utf8');
const $ = cheerio.load(source_html);

const normalize = css => {
  return css.replace(/#(\w+)/gi, hex => hex.toLowerCase())
  .replace(/\b0px/gi, '0')
  .replace(/white/gi, '#ffffff')
  .replace(/black/gi, '#000000')
  .replace(/#fff(;)?\b/gi, '#ffffff$1')
  .replace(/#000(;)?\b/gi, '#000000$1');
}

const source_css = fs.readFileSync(path.join(process.cwd(), 'css', 'main.css'), 'utf8');
const css = postcss([short]).process(normalize(source_css), { from: 'css/main.css' }).root;

const rules = css.nodes
  .filter(node => node.type === 'rule')
  .map(node => {
    const declarations = node.nodes
      .map(node => { return {[node.prop]: node.value}; })
      .reduce((result, current) => { return Object.assign(result, current); }, {});

    declarations['length'] = node.nodes.length;
    declarations['selector'] = node.selector;
    declarations['class'] = node.selector.replace(/^\./, '');
    declarations['css'] = node.toString().replace(/[^\x20-\x7E]/gmi, '').replace(/\s{2}/gmi, ' ');

    return declarations;
  });

const diff = (object, base, name) => {
  const isObject = o => o instanceof Object && o.constructor === Object;
  const changes = (base, check) => {
    const results = {};
    for (const key in base) {
      if (R.not(R.equals(base[key], check[key]))) {
        results[key] = (isObject(base[key]) && isObject(check[key])) ? changes(base[key], check[key]) : base[key];
      }
    }
    return results;
  }

  const results = changes(object, base);
  if (R.isEmpty(results)) {
    return { assert: true, message: '', class: base.class, selector: base.selector };
  } else {
    let message = 'It looks like your ' + name + ' rule is missing the following:\n';
    let selectorMessage = 'It seems that you are missing a rule with a selector of '
    for (let key in results) {
      if(key == 'selector') {
        message = selectorMessage + '`' + results[key] + '`.';
      } else {
        message += '\n- `' + key + ': ' + results[key] + '`';
      }
      
    }
    return { assert: false, message, class: base.class, selector: base.selector };
  }
};

const matchAny = (decl, selectors=[]) => {
  const decls = [];
  for (let prop in decl) {
    decls.push(R.propEq(prop, decl[prop]));
  }

  const selectorFunctions = [];
  for (let index = 0; index < selectors.length; index++) {
    selectorFunctions.push(R.propEq('selector', selectors[index]));
  }

  const matches = R.filter(R.anyPass(decls), rules)
  if (matches.length === 0) {
    return {};
  } else if (matches.length === 1) {
    return matches[0];
  } else if (matches.length >= 2) {
    return R.reject(R.anyPass(selectorFunctions), matches)[0];
  }
};

const diffAny = (decl, name, selectors=[]) => {
  return diff(decl, matchAny(decl, selectors), '`container`');
}

const matchAll = decl => {
  const rule = rules.filter(item => {
    for (let key in decl) {
      if (item[key] === undefined || item[key] != decl[key])
      return false;
    }
    return true;
  });
  return rule.length >= 1 ? true : false;
};

const getRule = selector => { 
  return rules.filter(rule => rule.selector === selector)[0];
};

Object.assign(global, {
  assert,
  $,
  css,
  rules,
  matchAny,
  matchAll,
  diff,
  diffAny,
  getRule
});