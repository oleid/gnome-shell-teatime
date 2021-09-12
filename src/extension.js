/* -*- mode: js2; js2-basic-offset: 4; indent-tabs-mode: t -*- */
/* Olaf Leidinger <oleid@mescharet.de>
   Thomas Liebetraut <thomas@tommie-lie.de>
*/

const Gio = imports.gi.Gio;
const GObject = imports.gi.GObject;
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


let PopupTeaMenuItem = GObject.registerClass(
	class PopupTeaMenuItem extends PopupMenu.PopupBaseMenuItem {
		_init(sTeaname, nBrewtime, params) {
			super._init(params);

			this.tealabel = new St.Label({
				text: sTeaname
			});
			if (nBrewtime != 0) {
				this.timelabel = new St.Label({
					text: Utils.formatTime(nBrewtime)
				});
			}

			this.add(this.tealabel);
			if (nBrewtime != 0) {
				this.add(this.timelabel);
			}

			this._delegate = this;
		}
	});

let TeaTime = GObject.registerClass(
	class TeaTime extends PanelMenu.Button {
		_init() {
			super._init(1.0, "TeaTime");

			this.config_keys = Utils.GetConfigKeys();

			this._settings = Utils.getSettings();

			this._logo = new Icon.TwoColorIcon(20, Icon.TeaPot);

			// set timer widget
			this._textualTimer = new St.Label({
				text: "",
				x_align: Clutter.ActorAlign.END,
				y_align: Clutter.ActorAlign.CENTER
			});
			this._graphicalTimer = new Icon.TwoColorIcon(20, Icon.Pie);

			this.add_actor(this._logo);
			this.add_style_class_name('panel-status-button');
			this.connect('style-changed', this._onStyleChanged.bind(this));

			this._idleTimeout = null;

			this._createMenu();
			this._continueRunningTimer();
		}

		_createMenu() {
			this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
			this._settings.connect("changed::" + this.config_keys.steep_times,
				this._updateTeaList.bind(this));
			this._settings.connect("changed::" + this.config_keys.graphical_countdown,
				this._updateCountdownType.bind(this));

			this.teaItemCont = new PopupMenu.PopupMenuSection();

			/*******************/
			// maybe one day the PopupImageMenuItem works^^
			let head = new PopupMenu.PopupMenuSection();
			let item = new PopupMenu.PopupMenuItem(_("Show settings")); //, 'gtk-preferences');
			//        item._icon.icon_size = 15;
			item.connect('activate', this._showPreferences.bind(this));
			head.addMenuItem(item);

			/*******************/
			let bottom = new PopupMenu.PopupMenuSection();
			this._customEntry = new St.Entry({
				style_class: 'teatime-custom-entry',
				track_hover: true,
				hint_text: _("min:sec")
			});
			this._customEntry.get_clutter_text().set_max_length(10);
			this._customEntry.get_clutter_text().connect("key-press-event", this._createCustomTimer.bind(this));
			bottom.box.add(this._customEntry);
			bottom.actor.set_style("padding: 0px 18px;")

			/*******************/

			this.menu.addMenuItem(head);
			this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
			this.menu.addMenuItem(this.teaItemCont);
			this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
			this.menu.addMenuItem(bottom);

			this._updateTeaList();
    		}

		_continueRunningTimer() {
			let running = this._settings.get_string(this.config_keys.running_timer).split("#");
			if (running.length == 2) {
				try {
					this._initCountdown(new Date(running[0]), parseInt(running[1]));
					this.graphicalCounter = 0; // redraw with correct values
				} catch (e) {
					// remove unreadable timer
					this._settings.set_string(this.config_keys.running_timer, '');
				}
			}
		}

		_updateTeaList(config, output) {
			// make sure the menu is empty
			this.teaItemCont.removeAll();

			// fill with new teas
			let list = this._settings.get_value(this.config_keys.steep_times).unpack();
			let menuItem = new PopupTeaMenuItem(_("Stop Timer"), 0);
			this.stopMenu = menuItem.tealabel
			menuItem.connect('activate', function () {
				this._stopCountdown();
			}.bind(this));
			this.teaItemCont.addMenuItem(menuItem);
			for (let teaname in list) {
				let time = list[teaname].get_uint32();

				let menuItem = new PopupTeaMenuItem(_(teaname), time);
				menuItem.connect('activate', function () {

					this._initCountdown(new Date(), time);
				}.bind(this));
				this.teaItemCont.addMenuItem(menuItem);
			}
		}

		_updateCountdownType(config, output) {
			let bWantGraphicalCountdown = this._settings.get_boolean(this.config_keys.graphical_countdown);

			if (bWantGraphicalCountdown != this._bGraphicalCountdown) {
				if (this._idleTimeout != null) {
					// we have a running countdown, replace the display
					this.remove_actor(this._bGraphicalCountdown ?
						this._graphicalTimer : this._textualTimer);
					this._bGraphicalCountdown = bWantGraphicalCountdown;
					this.add_actor(this._bGraphicalCountdown ?
						this._graphicalTimer : this._textualTimer);

					this._updateTimerDisplay(this._getRemainingSec());
				} // if timeout active
			} // value changed
		}

		_createCustomTimer(text, event) {
			if (event.get_key_symbol() == Clutter.KEY_Enter ||
				event.get_key_symbol() == Clutter.KEY_Return ||
				event.get_key_symbol() == Clutter.KEY_KP_Enter) {

				let customTime = text.get_text();
				let seconds = 0;
				let match = customTime.match(/^(?:(\d+)(?::(\d{0,2}))?|:(\d+))$/)
				if (match) {
					let factor = 1;
					if (match[3] === undefined) { // minutes and seconds?
						for (var i = match.length - 2; i > 0; i--) {
							let s = match[i] === undefined ? "" : match[i].replace(/^0/, ''); // fix for elder GNOME <= 3.10 which don't like leading zeros
							if (s.match(/^\d+$/)) { // only if something left
								seconds += factor * parseInt(s);
							}
							factor *= 60;
						}
					} else { // only seconds?
						let s = match[3].replace(/^0/, '');
						seconds = parseInt(s);
					}
					if (seconds > 0) {
						this._initCountdown(new Date(), seconds);
						this.menu.close();
					}
				}
				this._customEntry.set_text("");
			}
		}

		_showNotification(subject, text) {
			let source = new MessageTray.Source(_("TeaTime applet"), 'utilities-teatime');
			Main.messageTray.add(source);

			let notification = new MessageTray.Notification(source, subject, text);
			notification.setTransient(true);
			if (typeof source.showNotification === 'function') {
				source.showNotification(notification);
			} else {
				source.notify(notification);
			}
		}

		_initCountdown(startTime, time) {
			this._startTime = startTime;
			this._stopTime = new Date();
			this._cntdownStart = time;

			this._bGraphicalCountdown = this._settings.get_boolean(this.config_keys.graphical_countdown);

			this.graphicalInterval = this._bGraphicalCountdown ?
				Math.max(1.0, time / 90) // set time step to fit animation
				:
				1.0; // show every second for the textual countdown
			this.graphicalCounter = 0;
			this._stopTime.setTime(this._startTime.getTime() + time * 1000); // in msec

			this.remove_actor(this._logo); // show timer instead of default icon

			this._updateTimerDisplay(time);

			this.add_actor(this._bGraphicalCountdown ?
				this._graphicalTimer : this._textualTimer);

			if (this._idleTimeout != null) Mainloop.source_remove(this._idleTimeout);
			this._idleTimeout = Mainloop.timeout_add_seconds(1, this._doCountdown.bind(this));

			if (this._settings.get_boolean(this.config_keys.remember_running_timer)) {
				// remember timer
				this._settings.set_string(this.config_keys.running_timer, this._startTime.toJSON() + '#' + time);
			}
		}

		_stopCountdown() {
			if (this._idleTimeout != null) Mainloop.source_remove(this._idleTimeout);
			this.remove_actor(this._bGraphicalCountdown ?
				this._graphicalTimer : this._textualTimer);
			this.add_actor(this._logo);
			this._idleTimeout = null;
			// always remove remembered timer
			this._settings.set_string(this.config_keys.running_timer, '');
			this.stopMenu.text = _("Stop Timer");
		}

		_getRemainingSec() {
			let a = new Date();
			return (this._stopTime.getTime() - a.getTime()) * 1e-3;
		}

		_updateTimerDisplay(remainingTime) {
			if (this._bGraphicalCountdown) {
				if (this.graphicalCounter-- <= 0) {
					this.graphicalCounter = this.graphicalInterval;
					this._graphicalTimer.setStatus((this._cntdownStart - remainingTime) / this._cntdownStart);
				}
				this.stopMenu.text = _("Stop Timer") + ': ' + _('%s to go').replace('%s', Utils.formatTime(remainingTime));
			} else {
				this._textualTimer.text = Utils.formatTime(remainingTime);
				this.stopMenu.text = _("Stop Timer");
			}
		}

		_doCountdown() {
			let remainingTime = this._getRemainingSec();

			if (remainingTime <= 0) {
				// count down finished, switch display again
				this._stopCountdown();
				this._playSound();
				this._showNotification(_("Your tea is ready!"),
					_("Drink it, while it is hot!"));
				return false;
			} else {
				this._updateTimerDisplay(remainingTime);
				return true; // continue timer
			}
		}

		_playSound() {
			let bPlayAlarmSound = this._settings.get_boolean(this.config_keys.use_alarm_sound);
			if (bPlayAlarmSound) {
				Utils.playSound(this._settings.get_string(this.config_keys.alarm_sound));
			}
		}

		_showPreferences() {
			const currExt = ExtensionUtils.getCurrentExtension();
			imports.misc.util.spawn(["gnome-shell-extension-prefs", currExt.metadata['uuid']]);
			return 0;
		}

		_onStyleChanged(actor) {
			let themeNode = actor.get_theme_node();
			let color = themeNode.get_foreground_color()
			let [bHasPadding, padding] = themeNode.lookup_length("-natural-hpadding", false);

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
		}
	});

function init(metadata) {}

let _TeaTime;

function enable() {
	_TeaTime = new TeaTime();
	Main.panel.addToStatusArea('teatime', _TeaTime);
}

function disable() {
	if (_TeaTime._idleTimeout != null) Mainloop.source_remove(_TeaTime._idleTimeout);
	_TeaTime.destroy();
}
