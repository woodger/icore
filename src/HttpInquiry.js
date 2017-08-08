const HttpRouter 	= require('./HttpRouter');
const QS 					= require('querystring');
const Cookies 		= require('cookies');
const URL 				= require('url');




class ExecutedResponse {
	constructor(res) {
		this.response = res;
		this.submerged = false;


		this.body = '';

		res.on('data', data => {
			this.body += data;

			if (this.body.length > 1e6) {
				res.connection.destroy();
			}
		});


		res.on('end', () => {
			this.submerged = true;
		});
	}
	


	load() {
		let it = (resolve, reject) => {
			if (this.submerged === true) {
				resolve(this.body);
			}
			else {
				this.response
					.on('end', () => {
						resolve(this.body);
					})
					.on('error', e => {
						reject(e);
					});
			}
		};

		return new Promise(it);
	}
}





class InquiryRequest {
	constructor(req, res) {
		this.request = req;
		this.response = res;
		this.submerged = false;

		this.cookies = new Cookies(req, res);

		this.url = URL.parse(req.url);
		this.paths = this.url.pathname.substr(1).split('/');
		this.param = QS.parse(this.url.query);


		this.body = '';

		req
			.on('data', data => {
				this.body += data;

				if (this.body.length > 1e6) {
					req.connection.destroy();
				}
			})

			.on('end', () => {
				this.submerged = true;
			});
	}



	router(...args) {
		let options = {
			path: this.url.pathname,
			method: this.request.method
		};

		return new HttpRouter(this, ...args);
	}



	load() {
		let it = (resolve, reject) => {
			if (this.submerged === true) {
				resolve(this.body);
			}
			else {
				this.request
					.on('end', () => {
						resolve(this.body);
					})
					.on('error', e => {
						reject(e);
					});
			}
		};

		return new Promise(it);
	}



	echo({ status=200, type='text/html', body='' }) {
		let res = this.response;

		res.writeHeader(status , { 'Content-Type': type });
		res.write(body);
		res.end();
	}
}




module.exports = { ExecutedResponse, InquiryRequest };