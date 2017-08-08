const cleanSoul = str => {

	// Убрать служебные символы
	//str = str.replace(/\x0A\x0D/g, '');

	// Убрать спецсимволы
	str = str.replace(/[\t\r\n]/g, '');

	// Экранирование обратного апострофа
	str = str.replace(/`/g, '\\`');

	return str;
};




class Templates {
	render(patern='', inc={}) {
		let str = cleanSoul(patern);
		let keys = Object.keys(inc);
		let func = new Function(...keys, 'return `'+ str +'`;');
		let args = [];

		keys.forEach(key => args.push(inc[key]));
		str = func.apply(undefined, args);

		return str;
	}
}


module.exports = Templates;