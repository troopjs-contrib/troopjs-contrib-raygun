define([
	'when',
	'lodash',
	'troopjs-core/component/service',
	'raygun'
], function (when, _, Service) {

	var Raygun = window.Raygun;

	/**
	 * Report to Raygun **unhandled promise rejection** or **global uncaught JS error"
	 * https://raygun.io/docs/languages/javascript
	 * @param {String} key the Raygun API key
	 * @param {String} env the environment indicator either one of "dev", "uat", "qa", "stg" or "live"
	 * @param {Object} options Raygun configure options
	 */
	return Service.extend(function (key, env, options) {
		if(!(key && typeof env === 'string' && Raygun) ){
			throw new Error('Requires apikey / environment / window.Raygun');
		}
		this.token = key;
		this.env = env;
		this.options = options;
	}, {
		'sig/start': function () {
			var me = this;
			var df;

			// load the console monitor in dev
			if (this.env === 'dev') {
				df = when.defer();
				require(['when/monitor/console'], df.resolve);
				return df.promise;
			}

			var report = _.bind(me.report, me);
			// prepare for catching promise rejections
			if ('error' in console) {
				// intercept and report any console error(potentially unhandled rejections)
				console.error = _.after(console.error, report);
			}

			// init options
			var options = _.extend({
				allowInsecureSubmissions: true,
				ignoreAjaxAbort: false,
				ignoreAjaxError: false,
				ignore3rdPartyErrors: true,
				excludedHostnames: [
					'localhost',
					'\.dev'
				]
			}, this.options);

			// attach Raygun
			Raygun.init(this.token, options).withCustomData(_.bind(this.getData, this)).attach();
		},
		/**
		 * Override by application to send custom data with payload
		 */
		getData: function () { return {}; },
		/**
		 * Report a when.js promise rejection, or a plain JS error to Raygun
		 * @param {Error|String} rejection or error
		 */
		report: function (err) {

			// An native error object
			if (err instanceof Error) {
				Raygun.send(err);
			} else {

				if (typeof err === 'string') {
					err = err.split('\n');
				}

				// Remove possible custom when.js header message in case of promise rejection
				var title = err.shift().replace(/Potentially\sunhandled\srejection\s*\[\d\]\s*/, '');
				err = err.join('\n');

				// Send over to raygun.
				Raygun.send({
					name: 'Promise rejection',
					message: title,
					stack: err
				});
			}
		},
		'sig/stop': function () {
			Raygun.detach();
		}
	});
});
