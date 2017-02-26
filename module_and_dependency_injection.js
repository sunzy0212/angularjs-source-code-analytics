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
			run: function(fn) {
			    moduleInstance._runBlocks.push(fn);
				return moduleInstance; 
			},
			_invokeQueue: invokeQueue,
			_runBlocks: []

		};
		modules[name] = moduleInstance;
		return moduleInstance; 
	};
}

var INSTANTIATING = {};
function createInjector(modulesToLoad) { 
	var providerCache = {};
	var providerInjector = providerCache.$injector 
		= createInternalInjector(providerCache, function() {
		throw 'Unknown provider:' + path.join('<-'); 
	});
	var instanceCache = {};
	var instanceInjector = instanceCache.$injector 
		= createInternalInjector(instanceCache, function(name) {
		var provider = providerInjector.get(name + 'Provider');
		return instanceInjector.invoke(provider.$get, provider); 
	});
	var $provide = {
		constant: function(key, value) {
			instanceCache[key] = value;
		},
		provider: function(key, provider) { 
			if (_.isFunction(provider)) {
				provider = providerInjector.instantiate(provider); 
			}
			providerCache[key +  'Provider' ] = provider;
		}
	};

	var loadedModules = {};
	var runBlocks = [];
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
			runBlocks = runBlocks.concat(module._runBlocks);
		}
	});
	_.forEach(runBlocks, function(runBlock) {
	  	instanceInjector.invoke(runBlock);
	});
function createInternalInjector(cache, factoryFn){
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
		if (cache.hasOwnProperty(name)) {
			if (cache[name] === INSTANTIATING) {
				throw new Error('Circular dependency found.');
			}
			return cache[name];
		} else {
			// if an error occurred when executing provider.$get, should remove the marker.
			try {
				return (cache[name] = factoryFn(name)); 	
			} finally {
				if (cache[name] === INSTANTIATING) {
					delete cache[name]; 
				}
			}
		}	
	}
	return {
		has: function(key) {
			return cache.hasOwnProperty(key)
				|| providerCache.hasOwnProperty(key + 'Provider');
		},
		get: getService
		invoke: invoke,
		annotate: annotate
	}; 
}
	return instanceInjector;
}




