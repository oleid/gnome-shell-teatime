/* -*- mode: js2; js2-basic-offset: 4; indent-tabs-mode: t -*- */
/* Olaf Leidinger <oleid@mescharet.de>
   Thomas Liebetraut <thomas@tommie-lie.de>
*/

const Gio = imports.gi.Gio;
const Lang = imports.lang;
const Mainloop = imports.mainloop; // timer
const Shell = imports.gi.Shell;
const St = imports.gi.St;
const Clutter = imports.gi.Clutter;
const Layout = imports.ui.layout;

const Main = imports.ui.main;
const MessageTray = imports.ui.messageTray;
const PanelMenu = imports.ui.panelMenu;
const PopupMenu = imports.ui.popupMenu;
const Panel = imports.ui.panel;

const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const Utils = Me.imports.utils;
const Icon = Me.imports.icon;

const _ = Utils.getTranslationFunc();
const N_ = function (e) {
	return e;
};



const TeaTimeFullscreenNotification = new Lang.Class({
	Name: 'TeaTimeFullscreenNotification',

	_init: function () {
		// this spans the whole monitor and contains
		// the actual layout, which it displays in
		// the center of itself

		this._bin = new St.Bin({
			x_align: St.Align.MIDDLE,
			y_align: St.Align.MIDDLE
		});

		if (typeof Layout.MonitorConstraint != 'undefined') {
			// MonitorConstraint was introduced in gnome-3.6
			this._monitorConstraint = new Layout.MonitorConstraint();
			this._bin.add_constraint(this._monitorConstraint);
		}
		Main.uiGroup.add_actor(this._bin);

		// a table imitating a vertical box layout to hold the texture and
		// a label underneath it
		this._layout = new St.BoxLayout({
			vertical: true,
			y_align: Clutter.ActorAlign.CENTER
		});
		this._bin.set_child(this._layout);

		// find all the textures
		let datadir = Me.dir.get_child("data");
		this._textureFiles = [];
		if (datadir.query_exists(null)) {
			let enumerator = datadir.enumerate_children(Gio.FILE_ATTRIBUTE_STANDARD_NAME,
				Gio.FileQueryInfoFlags.NONE,
				null);
			let info;
			info = enumerator.next_file(null);
			while (info != null) {
				let filename = info.get_name();
				if (filename.match(/^cup.*/)) {
					this._textureFiles.push(datadir.get_child(filename).get_path());
				}
				info = enumerator.next_file(null);
			}
		}
		this._textureFiles.sort();

		this._texture = new Clutter.Texture({
			reactive: true,
			keep_aspect_ratio: true
		});
		this._texture.connect("button-release-event", Lang.bind(this, this.hide));
		this._layout.add_child(this._texture);

		this._timeline = new Clutter.Timeline({
			duration: 2000,
			repeat_count: -1,
			progress_mode: Clutter.AnimationMode.LINEAR
		});
		this._timeline.connect("new-frame", Lang.bind(this, this._newFrame));

		this._label = new St.Label({
			text: _("Your tea is ready!"),
			style_class: "dash-label"
		});
		this._layout.add_child(this._label);

		this._lightbox = new imports.ui.lightbox.Lightbox(Main.uiGroup); // Seems not to work on Gnome 3.10 { fadeInTime: 0.5, fadeOutTime: 0.5 }
		this._lightbox.highlight(this._bin);
	},
	destroy: function () {
		this.hide();
		Main.popModal(this._bin);
		this._bin.destroy();
		this._lightbox.hide();
	},
	_newFrame: function (timeline, msecs, user) {
		let progress = timeline.get_progress();
		let idx = Math.round(progress * this._textureFiles.length) % this._textureFiles.length;
		this._texture.set_from_file(this._textureFiles[idx]);
	},
	show: function () {
		if (typeof Layout.MonitorConstraint != 'undefined') {
			this._monitorConstraint.index = global.screen.get_current_monitor()
		}
		Main.pushModal(this._bin);
		this._timeline.start();
		this._lightbox.show();
		this._bin.show_all();
	},
	hide: function () {
		Main.popModal(this._bin);
		this._bin.hide();
		this._lightbox.hide();
		this._timeline.stop();
	}
})


const PopupTeaMenuItem = new Lang.Class({
	Name: 'PopupTeaMenuItem',
	Extends: PopupMenu.PopupBaseMenuItem,

	_init: function (sTeaname, nBrewtime, params) {
		this.parent(params);

		this.tealabel = new St.Label({
			text: sTeaname
		});
		this.timelabel = new St.Label({
			text: Utils.formatTime(nBrewtime)
		});

		if (this.actor instanceof St.BoxLayout) {
			// will be used for gnome-shell 3.10 and possibly above where this.actor is BoxLayout
			this.actor.add(this.tealabel, {
				expand: true
			});
			this.actor.add(this.timelabel);
		} else {
			this.addActor(this.tealabel, {
				expand: true
			});
			this.addActor(this.timelabel, {
				expand: false
			});
		}
	}
});


const TeaTime = new Lang.Class({
	Name: 'TeaTime',
	Extends: PanelMenu.Button,

	_init: function () {
		this.parent(null, "TeaTime");

		this._settings = Utils.getSettings();

		this._logo = new Icon.TwoColorIcon(24, Icon.TeaPot);

		// set timer widget
		this._textualTimer = new St.Label({
			text: "",
			x_align: Clutter.ActorAlign.END,
			y_align: Clutter.ActorAlign.CENTER
		});
		this._graphicalTimer = new Icon.TwoColorIcon(24, Icon.Pie);

		this._container = new Shell.GenericContainer();
		this._container.connect('get-preferred-width', Lang.bind(this, this._containerGetPreferredWidth));
		this._container.connect('get-preferred-height', Lang.bind(this, this._containerGetPreferredHeight));
		this._container.connect('allocate', Lang.bind(this, this._containerAllocate));

		this._container.add_actor(this._logo);
		this._container.add_actor(this._textualTimer);
		this._container.add_actor(this._graphicalTimer);

		this.actor.add_actor(this._container);
		this.actor.add_style_class_name('panel-status-button');
		this.actor.connect('style-changed', Lang.bind(this, this._onStyleChanged));

		this._idleTimeout = null;

		this._makeSureLogoIsVisible();
		this._createMenu();
	},
	_createMenu: function () {
		this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
		this._settings.connect("changed::" + this.config_keys.steep_times,
			Lang.bind(this, this._updateTeaList));
		this._settings.connect("changed::" + this.config_keys.graphical_countdown,
			Lang.bind(this, this._updateCountdownType));

		this.teaItemCont = new PopupMenu.PopupMenuSection();

		/*******************/
		// maybe one day the PopupImageMenuItem works^^
		let head = new PopupMenu.PopupMenuSection();
		let item = new PopupMenu.PopupMenuItem(_("Show settings")); //, 'gtk-preferences');
		//        item._icon.icon_size = 15;
		item.connect('activate', Lang.bind(this, this._showPreferences));
		head.addMenuItem(item);

		/*******************/
		let bottom = new PopupMenu.PopupMenuSection();
		this._customEntry = new St.Entry({
			style_class: 'teatime-custom-entry',
			track_hover: true,
			hint_text: _("min:sec")
		});
		this._customEntry.get_clutter_text().set_max_length(10);
		this._customEntry.get_clutter_text().connect("key-press-event", Lang.bind(this, this._createCustomTimer));
		bottom.box.add(this._customEntry);
		bottom.actor.set_style("padding: 0px 18px;")

		/*******************/

		this.menu.addMenuItem(head);
		this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
		this.menu.addMenuItem(this.teaItemCont);
		this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
		this.menu.addMenuItem(bottom);

		this._updateTeaList();
	},
	_updateTeaList: function (config, output) {
		// make sure the menu is empty
		this.teaItemCont.removeAll();

		// fill with new teas
		let list = this._settings.get_value(this.config_keys.steep_times).unpack();
		for (let teaname in list) {
			let time = list[teaname].get_uint32();

			let menuItem = new PopupTeaMenuItem(_(teaname), time);
			menuItem.connect('activate', Lang.bind(this, function () {
				this._initCountdown(time);
			}));
			this.teaItemCont.addMenuItem(menuItem);
		}
	},
	_updateCountdownType: function (config, output) {
		let bWantGraphicalCountdown = this._settings.get_boolean(this.config_keys.graphical_countdown);

		if (bWantGraphicalCountdown != this._bGraphicalCountdown) {
			if (this._idleTimeout != null) {
				this._makeSureCountdownIsVisible(bWantGraphicalCountdown);

				this._updateTimerDisplay(this._getRemainingSec());
			} // if timeout active
		} // value changed
	},
	_makeSureCountdownIsVisible: function (bWantGraphicalCountdown) {
		this._logo.visible = false;
		this._graphicalTimer.visible = bWantGraphicalCountdown;
		this._textualTimer.visible = !bWantGraphicalCountdown;
		this._bGraphicalCountdown = bWantGraphicalCountdown;
	},
	_makeSureLogoIsVisible: function () {
		this._logo.visible = true;
		this._graphicalTimer.visible = false;
		this._textualTimer.visible = false;
	},
	_createCustomTimer: function (text, event) {
		if (event.get_key_symbol() == Clutter.KEY_Enter ||
			event.get_key_symbol() == Clutter.KEY_Return) {

			let customTime = text.get_text();
			let seconds = 0;
			let match = customTime.match(/^(?:(\d+)(?::(\d{0,2}))?|:(\d+))$/)
			if (match) {
				let factor = 1;
				for (var i = match.length - 2; i > 0; i--) {
					let s = match[i].replace(/^0/, ''); // fix for elder GNOME <= 3.10 which don't like leading zeros
					seconds += factor * parseInt(s);
					factor *= 60;
				}
				if (seconds > 0) {
					this._initCountdown(seconds);
					this.menu.close();
				}
			}
			this._customEntry.set_text("");
		}
	},
	_showNotification: function (subject, text) {
		let source = (Utils.isGnome34()) ?
			new MessageTray.Source(_("TeaTime applet")) :
			new MessageTray.Source(_("TeaTime applet"), 'utilities-teatime');

		if (Utils.isGnome34()) {
			source.createNotificationIcon =
				function () {
					let iconBox = new St.Bin();
					iconBox._size = this.ICON_SIZE;
					iconBox.child = new St.Icon({
						icon_name: 'utilities-teatime',
						icon_type: St.IconType.FULLCOLOR,
						icon_size: iconBox._size
					});
					return iconBox;
				} // createNotificationIcon
		}

		Main.messageTray.add(source);

		let notification = new MessageTray.Notification(source, subject, text);
		notification.setTransient(true);
		source.notify(notification);
	},
	_initCountdown: function (time) {
		this._startTime = new Date();
		this._stopTime = new Date();
		this._cntdownStart = time;

		this._bGraphicalCountdown = this._settings.get_boolean(this.config_keys.graphical_countdown);

		let dt = this._bGraphicalCountdown ?
			Math.max(1.0, time / 90) // set time step to fit animation
			:
			1.0; // show every second for the textual countdown

		this._stopTime.setTime(this._startTime.getTime() + time * 1000); // in msec

		this._updateTimerDisplay(time);

		this._makeSureCountdownIsVisible(this._bGraphicalCountdown);

		if (this._idleTimeout != null) Mainloop.source_remove(this._idleTimeout);
		this._idleTimeout = Mainloop.timeout_add_seconds(dt, Lang.bind(this, this._doCountdown));
	},
	_getRemainingSec: function () {
		let a = new Date();
		return (this._stopTime.getTime() - a.getTime()) * 1e-3;
	},
	_updateTimerDisplay: function (remainingTime) {
		if (this._bGraphicalCountdown) {
			this._graphicalTimer.setStatus((this._cntdownStart - remainingTime) / this._cntdownStart);
		} else {
			this._textualTimer.text = Utils.formatTime(remainingTime);
		}
	},
	_doCountdown: function () {
		let remainingTime = this._getRemainingSec();

		if (remainingTime <= 0) {
			this._makeSureLogoIsVisible();
			this._playSound();

			if (!Utils.isGnome34() && this._settings.get_boolean(this.config_keys.fullscreen_notification)) {
				this.dialog = new TeaTimeFullscreenNotification();
				this.dialog.show();
			} else {
				this._showNotification(_("Your tea is ready!"),
					_("Drink it, while it is hot!"));
			}

			this._idleTimeout = null;
			return false;
		} else {
			this._updateTimerDisplay(remainingTime);
			return true; // continue timer
		}
	},
	_playSound: function () {
		let bPlayAlarmSound = this._settings.get_boolean(this.config_keys.use_alarm_sound);
		if (bPlayAlarmSound) {
			Utils.playSound(this._settings.get_string(this.config_keys.alarm_sound));
		}
	},
	_showPreferences: function () {
		imports.misc.util.spawn(["gnome-shell-extension-prefs", ExtensionUtils.getCurrentExtension().metadata['uuid']]);
		return 0;
	},
	_onStyleChanged: function (actor) {
		let themeNode = actor.get_theme_node();
		let color = themeNode.get_foreground_color()
		let [bHasPadding, padding] = themeNode.lookup_length("-natural-hpadding", false);
		let [bHasVPadding, v_padding] = themeNode.lookup_length("padding", false);

		Utils.debug("_onStyleChanged: hpadding " + padding + ", vpadding " + v_padding);

		this._primaryColor = color;
		this._secondaryColor = new Clutter.Color({
			red: color.red,
			green: color.green,
			blue: color.blue,
			alpha: color.alpha * 0.3
		});
		this._logo.setPadding(bHasPadding * padding);
		this._graphicalTimer.setPadding(bHasPadding * padding);
		this._textualTimer.margin_right = bHasPadding * padding;
		this._textualTimer.margin_left = bHasPadding * padding;

		this._logo.setColor(this._primaryColor, this._secondaryColor);
		this._graphicalTimer.setColor(this._primaryColor, this._secondaryColor);

		// forward (possible) scaling style change to child
		let scaling = Utils.getGlobalDisplayScaleFactor();
		this._logo.setScaling(scaling);
		this._graphicalTimer.setScaling(scaling);
	},
	_containerGetPreferredWidth: function (container, for_height, alloc) {
		// Here, and in _containerGetPreferredHeight, we need to query
		// for the height of all children, but we ignore the results
		// for those we don't actually display.

		let [text_min_width, text_natural_width] = this._textualTimer.is_visible() ?
			get_preferred_width(for_height) :
			[-1, -1];
		let [logo_min_width, logo_natural_width] = this._logo.get_preferred_width(for_height);

		Utils.debug("_containerGetPreferredWidth (label: " + this._textualTimer.is_visible() + ") " + for_height + " " + text_min_width + " / " + text_natural_width);
		Utils.debug("_containerGetPreferredWidth (logo)" + for_height + " " + logo_min_width + " / " + logo_natural_width);

		alloc.min_size = Math.max(text_min_width, logo_min_width);
		alloc.natural_size = Math.max(text_natural_width, logo_natural_width);
	},

	_containerGetPreferredHeight: function (container, for_width, alloc) {
		let max_min_height = 0,
			max_natural_height = 0;

		let [text_min_height, text_natural_height] = this._textualTimer.is_visible() ?
			this._textualTimer.get_preferred_height(for_width) :
			[-1, -1];
		let [logo_min_height, logo_natural_height] = this._logo.get_preferred_height(for_width);

		Utils.debug("_containerGetPreferredHeight (label:" + this._textualTimer.is_visible() + ") " + for_width + " " + text_min_height + " / " + text_natural_height);
		Utils.debug("_containerGetPreferredHeight (logo)" + for_width + " " + logo_min_height + " / " + logo_natural_height);

		alloc.min_size = Math.max(text_min_height, logo_min_height);
		alloc.natural_size = Math.max(text_natural_height, logo_natural_height);
	},

	_containerAllocate: function (container, box, flags) {
		// translate box to (0, 0)
		box.x2 -= box.x1;
		box.x1 = 0;
		box.y2 -= box.y1;
		box.y1 = 0;

		Utils.debug("_containerAllocate: box = [0, " + box.x2 + "; 0, " + box.y2 + "] , flags = " + JSON.stringify(flags));
		if (this._logo.is_visible()) {
			this._logo.allocate_align_fill(box, 0.5, 0.5, false, false, flags);
			this._logo._base_size = box.y2;
			this._logo.setScaling(1);
		}
		if (this._graphicalTimer.is_visible()) {
			this._graphicalTimer.allocate_align_fill(box, 0.5, 0.5, false, false, flags);
			this._graphicalTimer._base_size = box.y2 * 0.8;
			this._graphicalTimer.setScaling(1);
		}
		if (this._textualTimer.is_visible())
			this._textualTimer.allocate_align_fill(box, 0.5, 0.5, false, false, flags);
	},
	config_keys: Utils.GetConfigKeys()
});

function init(metadata) {
	let theme = imports.gi.Gtk.IconTheme.get_default();
	theme.append_search_path(metadata.path);
}

let _TeaTime;

function enable() {
	_TeaTime = new TeaTime();
	Main.panel.addToStatusArea('teatime', _TeaTime);
}

function disable() {
	if (_TeaTime._idleTimeout != null) Mainloop.source_remove(_TeaTime._idleTimeout);
	_TeaTime.destroy();
};
