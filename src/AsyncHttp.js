const HTTP 	= require('http');
const QS 		= require('querystring');
const { ExecutedResponse, InquiryRequest } = require('./HttpInquiry');




class AsyncHttp {
	server(obj, it) {
		let srv = HTTP.createServer((...args) => {
			let inq = new InquiryRequest(...args);
			it(inq);
		});

		srv.listen(obj);

		return srv;
	}



	request(obj) {
		let it = (resolve, reject) => {
			if (obj.data) {
				obj.headers = {
					'Content-Type': 'application/x-www-form-urlencoded',
					'Content-Length': Buffer.byteLength(obj.data)
				};
			}

			if (obj.param) {
				obj.path += '?'+ QS.stringify(obj.param);
				delete obj.param;
			}

			let req = HTTP.request(obj, res => {
				let exe = new ExecutedResponse(res);
				resolve(exe);
			});

			req.on('error', reject);

			if (obj.data) {
				req.write(obj.data);
			}

			req.end();
		};

		return new Promise(it);
	}
}




module.exports = AsyncHttp;