
class HttpRouter {
	constructor(inquiry) {
		this.inquiry = inquiry;
		this.done = false;
	}



	route({ method, path, query }, it) {
		let url = this.inquiry.url;
		let circs = [];

		if (typeof method == 'string') {
			method = [method];
		}

		if (path) {
			circs.push([path, url.path]);
		}

		if (query) {
			circs.push([query, url.query]);
		}


		if (
			this.done === false 
			&& 
			method.some(item => {
				if (item == this.inquiry.request.method) {
					return true;
				}
			}) 
			&& 
			circs.every(item => {
				let pattern = item[0].replace(/\//g, '\/');
				let regExp = new RegExp('^'+ pattern +'$');
				let res = regExp.test(item[1]);

				return res;
			})
		) {
			this.done = true;
			it(this.inquiry);
		}

		return this;
	}



	not(it) {
		if (this.done === false)	{
			it();
		}

		return this;
	}
}




module.exports = HttpRouter;