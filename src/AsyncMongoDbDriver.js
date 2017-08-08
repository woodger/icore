const MongoClient = require('mongodb').MongoClient;




class AsyncMongoDbDriver {
	constructor() {
		this.joint;
	}



	connect(nameDB='') {
		let location = 'mongodb://localhost:27017/'+ nameDB;

		let it = (resolve, reject) => {
			MongoClient.connect(location, (err, joint) => {
				if (err) reject(err);
				resolve(this.joint = joint);
			});
		};

		return new Promise(it);
	}
	


	close() {
		this.joint.close();
	}



	use(name) {
		return this.joint.collection(name);
	}



	insert(name, data = {}) {
		let it = (resolve, reject) => {
			let sample = this.use(name);

			sample.insert(data, (err, res) => {
				if (err) reject(err);
				resolve(res);
			});
		};

		return new Promise(it);
	}



	find(name) {
		let it = (resolve, reject) => {
			let sample = this.use(name);

			sample.find().toArray((err, res) => {
				if (err) reject(err);
				resolve(res);
			});
		};

		return new Promise(it);
	}



	update(name, data = {}) {
		let it = (resolve, reject) => {
			let sample = this.use(name);

			sample.update((err, res) => {
				if (err) reject(err);
				resolve(res);
			});
		};

		return new Promise(it);
	}
}




module.exports = AsyncMongoDbDriver;