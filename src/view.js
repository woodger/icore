const fs = require('fs');
const path = require('path');
const TypeEnforcement = require('type-enforcement');
const nebbia = require('nebbia');
const minimatch = require('minimatch');
const Inquiry = require('./inquiry');

const te = new TypeEnforcement({
  'constructor: new View()': {
    handler: Function,
    pwd: String
  },
  '#templateStrings()': {
    content: String
  },
  '#render()': {
    inquiry: Inquiry,
    options: Object
  },
  bundle: {
    copy: Array,
    templates: Object
  },
  decoration: {
    decoration: Object
  }
});

const config = 'bundle.json';
const {sep} = path;
const cwd = process.cwd();
const re = {
  arrow: / *-> */
};

const fsSync = {
  mkdir(dir) {
    if (fs.existsSync(dir)) {
      return;
    }

    const paths = dir.split(sep);
    const less = [];
    let item;

    while ((item = paths.pop())) {
      dir = paths.join(sep);
      less.push(item);

      if (fs.existsSync(dir)) {
        break;
      }
    }

    for (let i = less.length - 1; i >= 0; i--) {
      const item = less[i];
      dir += `${sep}${item}`;

      fs.mkdirSync(dir);
    }
  },

  copy(src, dir) {
    const base = path.basename(src);
    const use = `${dir}${sep}${base}`;

    fs.copyFileSync(src, use);
  }
};

const invoke = Symbol('handler');
const decor = Symbol('decor');

// Экземпляр нужно заморозить

class View {
  constructor(handler, pwd) {
    let err = te.validate('constructor: new View()', {
      handler,
      pwd
    });

    if (err) {
      throw err;
    }

    this[invoke] = handler;
    this.templates = {};

    pwd = path.resolve(cwd, pwd);

    const bundle = `${pwd}${sep}${config}`;
    const access = fs.accessSync(bundle, fs.constants.R_OK);

    if (access === false) {
      return;
    }

    const content = fs.readFileSync(bundle, 'utf8');
    const {copy = [], templates = {}} = JSON.parse(content);

    err = te.validate('bundle', {
      copy,
      templates
    });

    if (err) {
      throw err;
    }

    for (let i of copy) {
      let [src, dir] = i.split(re.arrow);

      src = `${pwd}/${src}`;
      dir = `${cwd}/${dir}`;

      fsSync.mkdir(dir);
      fsSync.copy(src, dir);
    }

    for (let i in templates) {
      const base = templates[i];
      let template = fs.readFileSync(`${pwd}/${base}`, 'utf8');
      let beautify;

      for (let i in this.constructor[decor]) {
        if (minimatch(base, i)) {
          let decoration = this.constructor[decor];
          beautify = decoration[i];

          break;
        }
      }

      if (beautify !== undefined) {
        template = beautify(template);
      }

      this.templates[i] = new Function('_', 'return ' + nebbia(template));
    }
  }

  render(inquiry, options = {}) {
    const err = te.validate('#render()', {
      inquiry,
      options
    });

    if (err) {
      throw err;
    }

    if (options.templates !== undefined) {
      throw new Error(`It is not allowed to use the 'templates' property`);
    }

    // Здесь нужно применить глубокое клонирование

    for (let i in this) {
      let item = this[i];

      if (item instanceof Array) {
        item = item.slice();
      }

      options[i] = item;
    }

    return this[invoke](inquiry, options);
  }
}

Object.defineProperty(View, 'decoration', {
  set: function(decoration) {
    const err = te.validate('decoration', {
      decoration
    });

    if (err) {
      throw err;
    }

    for (let i in decoration) {
      if (Object.getPrototypeOf(decoration[i]) !== Function.prototype) {
        throw new Error(`Decoration should be a function type`);
      }
    }

    this[decor] = decoration;
  }
});

module.exports = View;
