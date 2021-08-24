/* -*- mode: js2; js2-basic-offset: 4; indent-tabs-mode: t -*- */
/* Olaf Leidinger <oleid@mescharet.de>
   Thomas Liebetraut <thomas@tommie-lie.de>
*/

const ExtensionUtils = imports.misc.extensionUtils;

const ENABLE_LOGGING = false;

function debug(text) {
	if (ENABLE_LOGGING)
		log("**TeaTime >: " + text);
}

function GetConfigKeys() {
	return {
		steep_times: 'steep-times',
		graphical_countdown: 'graphical-countdown',
		use_alarm_sound: 'use-alarm-sound',
		alarm_sound: 'alarm-sound-file',
		running_timer: 'running-timer',
		remember_running_timer: 'remember-running-timer'
	};
}

function getExtensionLocaleDir() {
	// check if this extension was built with "make zip-file", and thus
	// has the locale files in a subfolder
	// otherwise assume that extension has been installed in the
	// same prefix as gnome-shell
	let localLocaleDir = ExtensionUtils.getCurrentExtension().dir.get_child('locale');
	let selectedDir = (localLocaleDir.query_exists(null)) ?
		localLocaleDir.get_path() :
		imports.misc.config.LOCALEDIR;

	debug("Using locale dir: " + selectedDir);

	return selectedDir;
}

function initTranslations(domain) {
	let extension = ExtensionUtils.getCurrentExtension();

	domain = domain || extension.metadata['gettext-domain'];

	imports.gettext.bindtextdomain(domain, getExtensionLocaleDir());
}

function getTranslationFunc() {
	let extension = ExtensionUtils.getCurrentExtension();
	let domain = extension.metadata['gettext-domain'];

	if (typeof getTranslationFunc.initialized == 'undefined') {
		initTranslations(domain);
		getTranslationFunc.initialized = true;
	}
	return imports.gettext.domain(domain).gettext;
}

function getSettings(schema) {
	const Gio = imports.gi.Gio;

	let extension = ExtensionUtils.getCurrentExtension();

	schema = schema || extension.metadata['settings-schema'];

	const GioSSS = Gio.SettingsSchemaSource;

	// check if this extension was built with "make zip-file", and thus
	// has the schema files in a subfolder
	// otherwise assume that extension has been installed in the
	// same prefix as gnome-shell (and therefore schemas are available
	// in the standard folders)
	let schemaDir = extension.dir.get_child('schemas');
	let schemaSource;
	if (schemaDir.query_exists(null)) {
		schemaSource = GioSSS.new_from_directory(schemaDir.get_path(),
			GioSSS.get_default(),
			false);
	} else {
		schemaSource = GioSSS.get_default();
	}

	let schemaObj = schemaSource.lookup(schema, true);
	if (!schemaObj)
		throw new Error('Schema ' + schema + ' could not be found for extension ' +
			extension.metadata.uuid + '. Please check your installation.');

	return new Gio.Settings({
		settings_schema: schemaObj
	});
}

function formatTime(sec_num) {
	/* toLocaleFormat would be nicer, however it doesn't work with
	   Debian Wheezy and some later gnome versions */

	// based on code from
	//  http://stackoverflow.com/questions/6312993/javascript-seconds-to-time-with-format-hhmmss

	let hours = Math.floor(sec_num / 3600);
	let minutes = Math.floor((sec_num - (hours * 3600)) / 60);
	let seconds = Math.round(sec_num - (hours * 3600) - (minutes * 60));

	if (hours < 10) {
		hours = "0" + hours;
	}
	if (minutes < 10) {
		minutes = "0" + minutes;
	}
	if (seconds < 10) {
		seconds = "0" + seconds;
	}

	return ((hours == "00") ? "" : hours + ':') + minutes + ':' + seconds;
}

function playSound(uri) {
	const Gst = imports.gi.Gst;

	debug("Playing " + uri);

	if (typeof this.player == 'undefined') {
		Gst.init(null);
		this.player = Gst.ElementFactory.make("playbin", "player");
		this.playBus = this.player.get_bus();
		this.playBus.add_signal_watch();
		this.playBus.connect("message",
			function (playBus, message) {
				if (message != null) {
					// IMPORTANT: to reuse the player, set state to READY
					let t = message.type;
					if (t == Gst.MessageType.EOS || t == Gst.MessageType.ERROR) {
						this.player.set_state(Gst.State.READY);
					}
				} // message handler
			}.bind(this));
	} // if undefined
	this.player.set_property('uri', uri);
	this.player.set_state(Gst.State.PLAYING);
}

function setCairoColorFromClutter(cr, c) {
	let s = 1.0 / 255;
	cr.setSourceRGBA(s * c.red, s * c.green, s * c.blue, s * c.alpha);
}

function getGlobalDisplayScaleFactor() {
	const St = imports.gi.St;
	return St.ThemeContext.get_for_stage(global.stage).scale_factor;
}

function isType(value, typename) {
	return typeof value == typename;
}
