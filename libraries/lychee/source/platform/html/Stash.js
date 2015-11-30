
lychee.define('Stash').tags({
	platform: 'html'
}).includes([
	'lychee.event.Emitter'
]).supports(function(lychee, global) {

	if (typeof Storage !== 'undefined') {

		try {

			if (typeof global.localStorage === 'object' && typeof global.sessionStorage === 'object') {
				return true;
			}

		} catch(e) {
			return false;
		}

	}


	return true;

}).exports(function(lychee, global, attachments) {

	var _JSON       = {
		encode: JSON.stringify,
		decode: JSON.parse
	};
	var _PERSISTENT = {
		data: {},
		read: function() {
			return null;
		},
		write: function(id, asset) {
			return false;
		}
	};
	var _TEMPORARY  = {
		data: {},
		read: function() {

			if (Object.keys(this.data).length > 0) {
				return this.data;
			}


			return null;

		},
		write: function(id, asset) {

			if (asset !== null) {
				this.data[id] = asset;
			} else {
				delete this.data[id];
			}

			return true;

		}
	};



	/*
	 * FEATURE DETECTION
	 */

	(function() {

		var local   = false;
		var session = false;


		try {
			local = 'localStorage' in global;
		} catch(e) {
			local = false;
		}

		try {
			session = 'sessionStorage' in global;
		} catch(e) {
			session = false;
		}


		if (local === true) {

			_PERSISTENT.read = function() {

				this.data = _JSON.decode(global.localStorage.getItem('lychee-Stash-PERSISTENT'));


				var blob = {};

				for (var id in this.data) {
					blob[id] = lychee.deserialize(this.data[id]);
				}

				return Object.keys(blob).length > 0 ? blob : null;

			};

			_PERSISTENT.write = function(id, asset) {

				var path = lychee.environment.resolve(id);
				if (path.substr(0, lychee.ROOT.project.length) === lychee.ROOT.project) {

					if (asset !== null) {

						var data = lychee.serialize(asset);
						if (data !== null && data.blob !== null && typeof data.blob.buffer === 'string') {

							var index = data.blob.buffer.indexOf('base64,') + 7;
							if (index > 7) {
								this.data[id] = data;
							}

						}

					} else {

						this.data[id] = null;

					}

				}


				global.localStorage.setItem('lychee-Stash-PERSISTENT', _JSON.encode(this.data));


				return true;

			};


			(function _initialize() {

				var data = _JSON.decode(global.localStorage.getItem('lychee-Stash-PERSISTENT'));
				if (data !== null) {

					for (var id in data) {
						_PERSISTENT.data[id] = data[id];
					}

				}

			})();

		}


		if (lychee.debug === true) {

			var methods = [];

			if (local)   methods.push('Persistent');
			if (session) methods.push('Temporary');


			if (methods.length === 0) {
				console.error('lychee.Stash: Supported methods are NONE');
			} else {
				console.info('lychee.Stash: Supported methods are ' + methods.join(', '));
			}

		}

	})();



	/*
	 * HELPERS
	 */

	var _is_asset = function(asset) {

		if (asset instanceof Object && typeof asset.serialize === 'function') {
			return true;
		}

		return false;

	};

	var _read_stash = function(silent) {

		silent = silent === true;


		var blob = null;


		var type = this.type;
		if (type === Class.TYPE.persistent) {

			blob = _PERSISTENT.read();

		} else if (type === Class.TYPE.temporary) {

			blob = _TEMPORARY.read();

		}


		if (blob !== null) {

			if (Object.keys(this.__assets).length !== Object.keys(blob).length) {

				this.__assets = {};

				for (var id in blob) {
					this.__assets[id] = blob[id];
				}


				this.trigger('sync', [ this.__assets ]);

			}


			return true;

		}


		return false;

	};

	var _write_stash = function(silent) {

		silent = silent === true;


		var operations = this.__operations;
		if (operations.length !== 0) {

			while (operations.length > 0) {

				var operation = operations.shift();
				if (operation.type === 'update') {

					if (this.__assets[operation.id] !== operation.asset) {
						this.__assets[operation.id] = operation.asset;
					}

				} else if (operation.type === 'remove') {

					if (this.__assets[operation.id] !== null) {
						this.__assets[operation.id] = null;
					}

				}

			}


			var type = this.type;
			if (type === Class.TYPE.persistent) {

				for (var id in this.__assets) {
					_PERSISTENT.write(id, this.__assets[id]);
				}

			} else if (type === Class.TYPE.temporary) {

				for (var id in this.__assets) {
					_TEMPORARY.write(id, this.__assets[id]);
				}

			}


			if (silent === false) {
				this.trigger('sync', [ this.__assets ]);
			}


			return true;

		}


		return false;

	};



	/*
	 * IMPLEMENTATION
	 */

	var _id = 0;

	var Class = function(data) {

		var settings = lychee.extend({}, data);


		this.id   = 'lychee-Stash-' + _id++;
		this.type = Class.TYPE.persistent;


		this.__assets     = {};
		this.__operations = [];


		this.setId(settings.id);
		this.setType(settings.type);


		lychee.event.Emitter.call(this);

		settings = null;



		/*
		 * INITIALIZATION
		 */

		_read_stash.call(this);

	};


	Class.TYPE = {
		persistent: 0,
		temporary:  1
	};


	Class.prototype = {

		/*
		 * ENTITY API
		 */

		sync: function(silent) {

			silent = silent === true;


			var result = false;


			if (Object.keys(this.__assets).length > 0) {

				this.__operations.push({
					type: 'sync'
				});

			}


			if (this.__operations.length > 0) {
				result = _write_stash.call(this, silent);
			} else {
				result = _read_stash.call(this, silent);
			}


			return result;

		},

		deserialize: function(blob) {

			if (blob.assets instanceof Object) {

				this.__assets = {};

				for (var id in blob.assets) {
					this.__assets[id] = lychee.deserialize(blob.assets[id]);
				}

			}

		},

		serialize: function() {

			var data = lychee.event.Emitter.prototype.serialize.call(this);
			data['constructor'] = 'lychee.Stash';

			var settings = {};
			var blob     = (data['blob'] || {});


			if (this.id.substr(0, 13) !== 'lychee-Stash-') settings.id   = this.id;
			if (this.type !== Class.TYPE.persistent)       settings.type = this.type;


			if (Object.keys(this.__assets).length > 0) {

				blob.assets = {};

				for (var id in this.__assets) {
					blob.assets[id] = lychee.serialize(this.__assets[id]);
				}

			}


			data['arguments'][0] = settings;
			data['blob']         = Object.keys(blob).length > 0 ? blob : null;


			return data;

		},



		/*
		 * CUSTOM API
		 */

		read: function(id) {

			id = typeof id === 'string' ? id : null;


			if (id !== null) {

				var asset = new lychee.Asset(id, true);
				if (asset !== null) {

					this.__assets[id] = asset;

					return asset;

				}

			}


			return null;

		},

		remove: function(id) {

			id = typeof id === 'string' ? id : null;


			if (id !== null) {

				this.__operations.push({
					type: 'remove',
					id:   id
				});


				this.__assets[id] = null;
				_write_stash.call(this);


				return true;

			}


			return false;

		},

		write: function(id, asset) {

			id    = typeof id === 'string'    ? id    : null;
			asset = _is_asset(asset) === true ? asset : null;


			if (id !== null && asset !== null) {

				this.__operations.push({
					type:  'update',
					id:    id,
					asset: asset
				});


				this.__assets[id] = asset;
				_write_stash.call(this);


				return true;

			}


			return false;

		},

		setId: function(id) {

			id = typeof id === 'string' ? id : null;


			if (id !== null) {

				this.id = id;

				return true;

			}


			return false;

		},

		setType: function(type) {

			type = lychee.enumof(Class.TYPE, type) ? type : null;


			if (type !== null) {

				this.type = type;

				return true;

			}


			return false;

		}

	};


	return Class;

});
