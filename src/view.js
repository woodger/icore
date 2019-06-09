const fs = require('fs');
const path = require('path');
const minimatch = require('minimatch');
const nebbia = require('nebbia');
const TypeEnforcement = require('type-enforcement');

const te = new TypeEnforcement({
  '#constructor()': {
    handler: Function,
    pwd: String
  },
  '#templateStrings()': {
    content: String
  },
  '#render()': {
    props: Object
  },
  '.viewrc': {
    copy: Array,
    templates: Object
  },
  decoration: {
    decoration: Object
  }
});

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

// Экземпляр нужно заморозить

class View {
  constructor(handler, pwd) {
    let err = te.validate('#constructor()', {
      handler,
      pwd
    });

    if (err) {
      throw err;
    }

    this.handler = handler;
    this.pwd = path.resolve(cwd, pwd);
    this.templates = {};

    const bundle = `${this.pwd}${sep}.viewrc`;
    const access = fs.accessSync(bundle, fs.constants.R_OK);

    if (access === false) {
      return;
    }

    const content = fs.readFileSync(bundle, 'utf8');
    const {copy = [], templates = {}} = JSON.parse(content);

    err = te.validate('.viewrc', {
      copy,
      templates
    });

    if (err) {
      throw err;
    }

    for (let i of copy) {
      let [src, dir] = i.split(re.arrow);

      dir = `${cwd}/${dir}`;

      fsSync.mkdir(dir);
      fsSync.copy(`${this.pwd}/${src}`, dir);
    }

    for (let i of templates) {
      const content = fs.readFileSync(`${pwd}/${i}`, 'utf8');
      const template = nebbia(content);

      this[i] = new Function('_', 'return ' + template);
    }
  }

  render(props = {}) {
    const err = te.validate('#render()', {
      props
    });

    if (err) {
      throw err;
    }

    if (props.templates !== undefined) {
      throw new Error(`It is not allowed to use the 'templates' property`);
    }

    // Здесь нужно применить глубокое клонирование

    for (let i in this) {
      let item = this[i];

      if (item instanceof Array) {
        item = item.slice();
      }

      props[i] = item;
    }

    return this.handler(props);
  }
}

module.exports = View;
