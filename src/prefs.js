/* -*- mode: js2; js2-basic-offset: 4; indent-tabs-mode: t -*- */
/* Olaf Leidinger <oleid@mescharet.de>
   Thomas Liebetraut <thomas@tommie-lie.de>
*/

const Gtk = imports.gi.Gtk;
const GObject = imports.gi.GObject;

const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const Utils = Me.imports.utils;

const _ = Utils.getTranslationFunc();
const N_ = function (e) {
	return e;
};


const Columns = {
	TEA_NAME: 0,
	STEEP_TIME: 1,
	ADJUSTMENT: 2
}

var TeaTimePrefsWidget = GObject.registerClass(
class TeaTimePrefsWidget extends Gtk.Grid {
	_init() {
		super._init({
			orientation: Gtk.Orientation.VERTICAL,
			column_homogeneous: false,
			vexpand: true,
			margin: 5,
			row_spacing: 5
		});

		this.config_keys = Utils.GetConfigKeys();

			this._tealist = new Gtk.ListStore();
			this._tealist.set_column_types([
				GObject.TYPE_STRING,
				GObject.TYPE_INT,
				Gtk.Adjustment
			]);

			this.set_column_spacing(3);

			this._settings = Utils.getSettings();
			this._inhibitUpdate = true;
			this._settings.connect("changed", this._refresh.bind(this));

			this._initWindow();
			this._inhibitUpdate = false;
			this._refresh();
			this._tealist.connect("row-changed", this._save.bind(this));
			this._tealist.connect("row-deleted", this._save.bind(this));
	}

	_initWindow() {
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
			this.fullscreenNotificationSwitch.connect("notify::active", this._saveFullscreenNotifications.bind(this));

			this.graphicalCountdownSwitch = new Gtk.Switch();
			this.graphicalCountdownSwitch.connect("notify::active", this._saveGraphicalCountdown.bind(this));

			// alarm sound file chooser
			this.alarmSoundSwitch = new Gtk.Switch();
			this.alarmSoundSwitch.connect("notify::active", this._saveUseAlarm.bind(this));


			this.alarmSoundFile = new Gtk.FileChooserButton({
				title: _("Select alarm sound file"),
				action: Gtk.FileChooserAction.OPEN
			});
			this.alarmSoundFileFilter = new Gtk.FileFilter();
			this.alarmSoundFile.set_filter(this.alarmSoundFileFilter);
			this.alarmSoundFileFilter.add_mime_type("audio/*");
			this.alarmSoundFile.connect("selection_changed", this._saveSoundFile.bind(this));


			if (!Utils.isGnome34()) {
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
			renderer.connect("edited", function (renderer, pathString, newValue) {
				let [store, iter] = this._tealist.get_iter(Gtk.TreePath.new_from_string(pathString));
				this._tealist.set(iter, [Columns.TEA_NAME], [newValue]);
			}.bind(this));
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
			spinrenderer.connect("edited", function (renderer, pathString, newValue) {
				let [store, iter] = this._tealist.get_iter(Gtk.TreePath.new_from_string(pathString));
				this._tealist.set(iter, [Columns.STEEP_TIME], [parseInt(newValue)]);
			}.bind(this));

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
			this.addButton.connect("clicked", this._addTea.bind(this));
			this.toolbar.insert(this.addButton, -1);
			this.removeButton = new Gtk.ToolButton({
				icon_name: "list-remove-symbolic",
				use_action_appearance: false
			});
			this.removeButton.connect("clicked", this._removeSelectedTea.bind(this));
			this.toolbar.insert(this.removeButton, -1);
	}

	_refresh() {
			// don't update the model if someone else is messing with the backend
			if (this._inhibitUpdate)
				return;

			this.fullscreenNotificationSwitch.active = this._settings.get_boolean(this.config_keys.fullscreen_notification)

			this.graphicalCountdownSwitch.active = this._settings.get_boolean(this.config_keys.graphical_countdown)
			this.alarmSoundSwitch.active = this._settings.get_boolean(this.config_keys.use_alarm_sound)
			let list = this._settings.get_value(this.config_keys.steep_times).unpack();
			let file_name = this._settings.get_string(this.config_keys.alarm_sound);
			this.alarmSoundFile.set_uri(file_name);

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
	}

	_addTea() {
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
	}

	_removeSelectedTea() {
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
	}

	_saveFullscreenNotifications(sw, data) {
			// don't update the backend if someone else is messing with the model
			if (this._inhibitUpdate)
				return;
			this._inhibitUpdate = true;
			this._settings.set_boolean(this.config_keys.fullscreen_notification,
				sw.active);
			this._inhibitUpdate = false;
	}

	_saveGraphicalCountdown(sw, data) {
			// don't update the backend if someone else is messing with the model
			if (this._inhibitUpdate)
				return;
			this._inhibitUpdate = true;
			this._settings.set_boolean(this.config_keys.graphical_countdown,
				sw.active);
			this._inhibitUpdate = false;
	}

	_saveUseAlarm(sw, data) {
			// don't update the backend if someone else is messing with the model
			if (this._inhibitUpdate)
				return;
			this._inhibitUpdate = true;
			this._settings.set_boolean(this.config_keys.use_alarm_sound,
				sw.active);
			this._inhibitUpdate = false;
	}

	_saveSoundFile(sw, data) {
			// don't update the backend if someone else is messing with the model
			if (this._inhibitUpdate)
				return;
			let alarm_sound = this.alarmSoundFile.get_uri();
			Utils.debug(this._settings.get_string(this.config_keys.alarm_sound) + "-->" + alarm_sound);

			let have_value = Utils.isType(alarm_sound, "string");
			let setting_is_different =
				this._settings.get_string(this.config_keys.alarm_sound) != alarm_sound;
			if (have_value && setting_is_different) {
				this._inhibitUpdate = true;

				Utils.playSound(alarm_sound);
				this._settings.set_string(this.config_keys.alarm_sound, alarm_sound);
				this._inhibitUpdate = false;
			}
	}

	_save(store, path_, iter_) {
			const GLib = imports.gi.GLib;

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

			this._settings.set_value(this.config_keys.steep_times, settingsValue);

			this._inhibitUpdate = false;
	}
});

function init() {}

function buildPrefsWidget() {
	let widget = new TeaTimePrefsWidget();

	widget.show_all();
	return widget;
}
