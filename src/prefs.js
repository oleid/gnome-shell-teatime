/* -*- mode: js2; js2-basic-offset: 4; indent-tabs-mode: nil -*- */
/* Olaf Leidinger <oleid@mescharet.de>
   Thomas Liebetraut <thomas@tommie-lie.de>
*/

const Gdk = imports.gi.Gdk;
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const Mainloop = imports.mainloop; // timer
const Clutter = imports.gi.Clutter;

const Lang = imports.lang;
const Gtk = imports.gi.Gtk;
const GObject = imports.gi.GObject;

const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const Utils = Me.imports.utils;

const bUseGnome34Workarounds = imports.misc.extensionUtils.versionCheck(["3.4"], imports.misc.config.PACKAGE_VERSION);

const _ = Utils.getTranslationFunc();
const N_ = function (e) {
	return e;
};



const Columns = {
	TEA_NAME: 0,
	STEEP_TIME: 1,
	ADJUSTMENT: 2
}

const TeaTimePrefsWidget = new Lang.Class({
	Name: 'TeaTimePrefsWidget',
	Extends: Gtk.Grid,

	_init: function () {
		this.parent({
			orientation: Gtk.Orientation.VERTICAL,
			column_homogeneous: false,
			vexpand: true,
			margin: 5,
			row_spacing: 5
		});

		this._tealist = new Gtk.ListStore();
		this._tealist.set_column_types([
			GObject.TYPE_STRING,
			GObject.TYPE_INT,
			Gtk.Adjustment
		]);

		this.set_column_spacing(3);

		this._settings = Utils.getSettings();
		this._inhibitUpdate = true;
		this._settings.connect("changed", Lang.bind(this, this._refresh));

		this._initWindow();
		this._inhibitUpdate = false;
		this._refresh();
		this._tealist.connect("row-changed", Lang.bind(this, this._save));
		this._tealist.connect("row-deleted", Lang.bind(this, this._save));
	},
	_initWindow: function () {
		let curRow = 0;
		let labelFN = new Gtk.Label({
			label: _("Fullscreen Notifications"),
			hexpand: true,
			halign: Gtk.Align.START
		});
		let labelGC = new Gtk.Label({
			label: _("Graphical Countdown"),
			hexpand: true,
			halign: Gtk.Align.START
		});

		let labelAS = new Gtk.Label({
			label: _("Alarm sound"),
			hexpand: true,
			halign: Gtk.Align.START
		});

		this.fullscreenNotificationSwitch = new Gtk.Switch();
		this.fullscreenNotificationSwitch.connect("notify::active", Lang.bind(this, this._saveFullscreenNotifications));

		this.graphicalCountdownSwitch = new Gtk.Switch();
		this.graphicalCountdownSwitch.connect("notify::active", Lang.bind(this, this._saveGraphicalCountdown));

		// alarm sound file chooser
		this.alarmSoundSwitch = new Gtk.Switch();
		this.alarmSoundSwitch.connect("notify::active", Lang.bind(this, this._saveUseAlarm));


		this.alarmSoundFile = new Gtk.FileChooserButton({
			title: _("Select alarm sound file"),
			action: Gtk.FileChooserAction.OPEN
		});
		this.alarmSoundFileFilter = new Gtk.FileFilter();
		this.alarmSoundFile.set_filter(this.alarmSoundFileFilter);
		this.alarmSoundFileFilter.add_mime_type("audio/*");
		this.alarmSoundFile.connect("selection_changed", Lang.bind(this, this._saveSoundFile));


		if (!bUseGnome34Workarounds) {
			// Full screen notifications currently not working on GNOME 3.4, thus don't show the switch
			this.attach(labelFN, 0 /*col*/ , curRow /*row*/ , 2 /*col span*/ , 1 /*row span*/ );
			this.attach(this.fullscreenNotificationSwitch, 2, curRow, 1, 1);
			curRow += 1;
		}

		this.attach(labelGC, 0 /*col*/ , curRow /*row*/ , 2 /*col span*/ , 1 /*row span*/ );
		this.attach(this.graphicalCountdownSwitch, 2, curRow, 1, 1);
		curRow += 1;

		this.attach(labelAS, 0 /*col*/ , curRow /*row*/ , 1 /*col span*/ , 1 /*row span*/ );
		this.attach(this.alarmSoundFile, 1, curRow, 1, 1);
		this.attach(this.alarmSoundSwitch, 2, curRow, 1, 1);
		curRow += 1;

		this.treeview = new Gtk.TreeView({
			model: this._tealist,
			expand: true
		});
		this.treeview.set_reorderable(true);
		this.treeview.get_selection().set_mode(Gtk.SelectionMode.MULTIPLE);
		this.attach(this.treeview, 0, curRow, 3, 1);
		curRow += 1;

		let teaname = new Gtk.TreeViewColumn({
			title: _("Tea"),
			expand: true
		});
		let renderer = new Gtk.CellRendererText({
			editable: true
		});
		// When the renderer is done editing it's value, we first write
		// the new value to the view's model, i.e. this._tealist.
		// This makes life a little harder due to chaining of callbacks
		// and the need for this._inhibitUpdate, but it feels a lot cleaner
		// when the UI does not know about the config storage backend.
		renderer.connect("edited", Lang.bind(this, function (renderer, pathString, newValue) {
			let [store, iter] = this._tealist.get_iter(Gtk.TreePath.new_from_string(pathString));
			this._tealist.set(iter, [Columns.TEA_NAME], [newValue]);
		}));
		teaname.pack_start(renderer, true);
		teaname.add_attribute(renderer, "text", Columns.TEA_NAME);
		this.treeview.append_column(teaname);

		let steeptime = new Gtk.TreeViewColumn({
			title: _("Steep time"),
			min_width: 150
		});
		let spinrenderer = new Gtk.CellRendererSpin({
			editable: true
		});
		// See comment above.
		spinrenderer.connect("edited", Lang.bind(this, function (renderer, pathString, newValue) {
			let [store, iter] = this._tealist.get_iter(Gtk.TreePath.new_from_string(pathString));
			this._tealist.set(iter, [Columns.STEEP_TIME], [parseInt(newValue)]);
		}));

		steeptime.pack_start(spinrenderer, true);
		steeptime.add_attribute(spinrenderer, "adjustment", Columns.ADJUSTMENT);
		steeptime.add_attribute(spinrenderer, "text", Columns.STEEP_TIME);
		this.treeview.append_column(steeptime);


		this.toolbar = new Gtk.Toolbar({
			icon_size: 1
		});
		this.toolbar.get_style_context().add_class("inline-toolbar");
		this.attach(this.toolbar, 0 /*col*/ , curRow /*row*/ , 3 /*col span*/ , 1 /*row span*/ );
		this.addButton = new Gtk.ToolButton({
			icon_name: "list-add-symbolic",
			use_action_appearance: false
		});
		this.addButton.connect("clicked", Lang.bind(this, this._addTea));
		this.toolbar.insert(this.addButton, -1);
		this.removeButton = new Gtk.ToolButton({
			icon_name: "list-remove-symbolic",
			use_action_appearance: false
		});
		this.removeButton.connect("clicked", Lang.bind(this, this._removeSelectedTea));
		this.toolbar.insert(this.removeButton, -1);
	},
	_refresh: function () {
		// don't update the model if someone else is messing with the backend
		if (this._inhibitUpdate)
			return;

		this.fullscreenNotificationSwitch.active = this._settings.get_boolean(Utils.TEATIME_FULLSCREEN_NOTIFICATION_KEY)

		this.graphicalCountdownSwitch.active = this._settings.get_boolean(Utils.TEATIME_GRAPHICAL_COUNTDOWN_KEY)
		this.alarmSoundSwitch.active = this._settings.get_boolean(Utils.TEATIME_USE_ALARM_SOUND_KEY)
		let list = this._settings.get_value(Utils.TEATIME_STEEP_TIMES_KEY).unpack();
		this.alarmSoundFile.set_uri(this._settings.get_string(Utils.TEATIME_ALARM_SOUND_KEY));

		// stop everyone from reacting to the changes we are about to produce
		// in the model
		this._inhibitUpdate = true;

		this._tealist.clear();
		for (let teaname in list) {
			let time = list[teaname].get_uint32();

			let adj = new Gtk.Adjustment({
				lower: 1,
				step_increment: 1,
				upper: 65535,
				value: time
			});
			this._tealist.set(this._tealist.append(), [Columns.TEA_NAME, Columns.STEEP_TIME, Columns.ADJUSTMENT], [teaname, time, adj]);
		}

		this._inhibitUpdate = false;
	},
	_addTea: function () {
		let adj = new Gtk.Adjustment({
			lower: 1,
			step_increment: 1,
			upper: 65535,
			value: 1
		});
		let item = this._tealist.append();
		this._tealist.set(item, [Columns.TEA_NAME, Columns.STEEP_TIME, Columns.ADJUSTMENT], ["", 1, adj]);
		this.treeview.set_cursor(this._tealist.get_path(item),
			this.treeview.get_column(Columns.TEA_NAME),
			true);
	},
	_removeSelectedTea: function () {
		let [selection, store] = this.treeview.get_selection().get_selected_rows();
		let iters = [];
		for (let i = 0; i < selection.length; ++i) {
			let [isSet, iter] = store.get_iter(selection[i]);
			if (isSet) {
				iters.push(iter);
			}
		}
		// it's ok not to inhibit updates here as remove != change
		iters.forEach(function (value, index, array) {
			store.remove(value)
		});

		this.treeview.get_selection().unselect_all();
	},
	_saveFullscreenNotifications: function (sw, data) {
		// don't update the backend if someone else is messing with the model
		if (this._inhibitUpdate)
			return;
		this._inhibitUpdate = true;
		this._settings.set_boolean(Utils.TEATIME_FULLSCREEN_NOTIFICATION_KEY,
			sw.active);
		this._inhibitUpdate = false;
	},
	_saveGraphicalCountdown: function (sw, data) {
		// don't update the backend if someone else is messing with the model
		if (this._inhibitUpdate)
			return;
		this._inhibitUpdate = true;
		this._settings.set_boolean(Utils.TEATIME_GRAPHICAL_COUNTDOWN_KEY,
			sw.active);
		this._inhibitUpdate = false;
	},
	_saveUseAlarm: function (sw, data) {
		// don't update the backend if someone else is messing with the model
		if (this._inhibitUpdate)
			return;
		this._inhibitUpdate = true;
		this._settings.set_boolean(Utils.TEATIME_USE_ALARM_SOUND_KEY,
			sw.active);
		this._inhibitUpdate = false;
	},
	_saveSoundFile: function (sw, data) {
		// don't update the backend if someone else is messing with the model
		if (this._inhibitUpdate)
			return;
		if (this._settings.get_string(Utils.TEATIME_ALARM_SOUND_KEY) != this.alarmSoundFile.get_uri()) {
			this._inhibitUpdate = true;

			let uri = this.alarmSoundFile.get_uri();

			Utils.playSound(uri);
			this._settings.set_string(Utils.TEATIME_ALARM_SOUND_KEY, uri);
			this._inhibitUpdate = false;
		}
	},
	_save: function (store, path_, iter_) {
		// don't update the backend if someone else is messing with the model
		if (this._inhibitUpdate)
			return;

		let values = [];
		this._tealist.foreach(function (store, path, iter) {
			values.push(GLib.Variant.new_dict_entry(
				GLib.Variant.new_string(store.get_value(iter, Columns.TEA_NAME)),
				GLib.Variant.new_uint32(store.get_value(iter, Columns.STEEP_TIME))))
		});
		let settingsValue = GLib.Variant.new_array(GLib.VariantType.new("{su}"), values);

		// all changes have happened through the UI, we can safely
		// disable updating it here to avoid an infinite loop
		this._inhibitUpdate = true;

		this._settings.set_value(Utils.TEATIME_STEEP_TIMES_KEY, settingsValue);

		this._inhibitUpdate = false;
	}
});


function init() {}

function buildPrefsWidget() {
	let widget = new TeaTimePrefsWidget();

	widget.show_all();
	return widget;
}
