const FS = require('fs');


/*
Основные функции файловой системы:
- именование файлов;
- программный интерфейс работы с файлами для приложений;
- отображения логической модели файловой системы на физическую организацию хранилища данных;
- организация устойчивости файловой системы к сбоям питания, ошибкам аппаратных и программных средств;
- содержание параметров файла, необходимых для правильного его взаимодействия с другими объектами системы
*/

class AsyncFileSystem {
	readDir(dirname='') {
		let it = (resolve, reject) => {
			FS.readdir(dirname, (err, data) => {
				if (err) {
					reject(err);
				}

				resolve(data);
			});
		};

		return new Promise(it);
	}



	readFile(filename='') {
		let it = (resolve, reject) => {
			FS.readFile(filename, 'utf8', (err, data) => {
				if (err) {
					reject(err);
				}

				resolve(data);
			});
		};

		return new Promise(it);
	}
}




module.exports = AsyncFileSystem;