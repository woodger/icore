const SRC = require('./src');

const {
	AsyncMongoDbDriver,
		 AsyncFileSystem,
					 AsyncHttp,
					 Templates
} = SRC;





class ICore {
	constructor(conf) {
		this.conf = conf;
		
		this.http = new AsyncHttp();
		this.tmpl = new Templates();
		this.fs 	= new AsyncFileSystem();
		this.db 	= new AsyncMongoDbDriver();
	}



	queue({ cmds=[], it, beth, done }) {
		let i = 0;

		return new Promise((resolve, reject) => {
			let loop = () => {
				it({ item: cmds[i], index: i, beth }).then(body => {
					i++;
					
					if (typeof done == 'function') {
						done(body);
					}

					if (!cmds[i]) {
						return resolve(body);
					}
					
					loop();
				},
				reject);
			};

			if (!cmds.length) {
				return resolve();
			}

			loop();
		});
	}
}




module.exports = ICore;