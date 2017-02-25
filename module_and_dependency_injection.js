function setupModuleLoader(window) {
	var ensure = function(obj, name, factory) {
		return obj[name] || (obj[name] = factory()); 
	};

	// extend angular to window
	var angular = ensure(window, 'angular', Object);

	// extend module to angular
	ensure(angular, 'module', function() { 
		var modules = {};
		return function(name, requires) {
			if (requires) {
				return createModule(name, requires, modules);
			} else {
				return getModule(name, modules);
			} };
		}
	);

	
	var createModule = function(name, requires, modules) { 
		if (name === 'hasOwnProperty') {
			throw 'hasOwnProperty is not a valid module name'; 
		}
		var invokeQueue = []; 
		var invokeLater = function(method) { 
			return function() {
				invokeQueue.push([method, arguments]);
				return moduleInstance; 
			};
		};

		var moduleInstance = {
			name: name,
			requires: requires,
			constant: invokeLater('constant'), 
			provider: invokeLater('provider'),
			_invokeQueue: invokeQueue
		};
		modules[name] = moduleInstance;
		return moduleInstance; 
	};
}

var INSTANTIATING = {};
function createInjector(modulesToLoad) { 
	var providerCache = {};	// cache of provider
	var instanceCache = {};	// cache of instance of provider
	var $provide = {
		constant: function(key, value) {
			instanceCache[key] = value;
		},
		provider: function(key, provider) { 
			providerCache[key +  'Provider' ] = provider;
		}
	};

	var loadedModules = {};
	_.forEach(modulesToLoad, function loadModule(moduleName) { 
		if (!loadedModules.hasOwnProperty(moduleName)) {
			loadedModules[moduleName] = true;
			var module = angular.module(moduleName); 
			_.forEach(module.requires, loadModule); 
			_.forEach(module._invokeQueue, function(invokeArgs) {
				var method = invokeArgs[0];
				var args = invokeArgs[1]; 
				$provide[method].apply($provide, args);
			});
		}
	});

	function invoke(fn, self, locals) {
		var args = _.map(fn.$inject, function(token) {
			if (_.isString(token)) {
				return locals && locals.hasOwnProperty(token) ?
					locals[token] : getService[token]; 
			} else {
				throw 'Incorrect injection token! Expected a string, got '+token; 
			}
		});
		return fn.apply(self, args); 
	}

	function getService(name) {
		if (instanceCache.hasOwnProperty(name)) {
			if (instanceCache[name] === INSTANTIATING) {
				throw new Error('Circular dependency found.');
			}
			return instanceCache[name];
		} else if (providerCache.hasOwnProperty(name + 'Provider' )) {
			// if an error occurred when executing provider.$get, should remove the marker.
			try {
				instanceCache[name] = INSTANTIATING;
				var provider = providerCache[name + 'Provider' ];
				var instance = instanceCache[name] = invoke(provider.$get, provider);
				return instance; 	
			} finally {
				if (instanceCache[name] === INSTANTIATING) {
					delete instanceCache[name]; 
				}
			}
		}	
	}

	return {
		has: function(key) {
			return instanceCache.hasOwnProperty(key)
				|| providerCache.hasOwnProperty(key + 'Provider');
		},
		get: getService
		invoke: invoke,
		annotate: annotate
	}; 
}




