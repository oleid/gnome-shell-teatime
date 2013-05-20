/* -*- mode: js2; js2-basic-offset: 4; indent-tabs-mode: nil -*- */
/* Olaf Leidinger <oleid@mescharet.de>  20130318  */

const Gdk = imports.gi.Gdk;
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const GnomeDesktop = imports.gi.GnomeDesktop;
const Lang = imports.lang;
const Mainloop = imports.mainloop; // timer
const Shell = imports.gi.Shell;
const St = imports.gi.St;
const Clutter = imports.gi.Clutter;

const Main        = imports.ui.main;
const MessageTray = imports.ui.messageTray;
const PanelMenu   = imports.ui.panelMenu;
const PopupMenu   = imports.ui.popupMenu;
const Panel       = imports.ui.panel;

const Gettext = imports.gettext.domain('gnome-shell-extensions');
const _ = Gettext.gettext;
const N_ = function(e) { return e; };

const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();

// TODO: make this configurable via gsettings
const defaultTeaList = [
            {name : "Green tea", time : 180 }, 
            {name : "Black tea", time : 210 }, 
            {name : "Fruit tea", time : 7 * 60}, 
            {name : "White tea", time : 120} 
            ];

const TeaTime = new Lang.Class({
    Name : 'TeaTime',
    Extends : PanelMenu.Button,

    _init : function() {
        this.parent(0.0, "TeaTime");

        this._logo = new St.Icon({
            icon_name : 'utilities-teatime',
            style_class : 'system-status-icon'
        });

        // set timer widget

        this._timer = new St.DrawingArea({
            reactive : true
        });
        this._timer.set_width(20);
        this._timer.set_height(20);
        this._timer.connect('repaint', Lang.bind(this, this._drawTimer));

        this.actor.add_actor(this._logo);

        this._dt = 4;
        this._idleTimeout = null;

        this._createMenu();
    },

    _createMenu : function() {
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        this._addTeaList();
    },
    _formatTime : function(seconds) {
        let a = new Date(0,0,0); // important: hour needs to be set to zero in _locale_ time

        a.setTime(a.getTime()+ seconds * 1000); // set time in msec, adding the time we want

        if (seconds > 3600) 
            return a.toLocaleFormat("%H:%M:%S");
        else 
            return a.toLocaleFormat("%M:%S");
    },
    _addTeaList : function(config, output) {
        let  item = new PopupMenu.PopupMenuItem(_("brewing times"));
        item.label.add_style_class_name('display-subtitle');
        item.actor.reactive = false;
        item.actor.can_focus = false;
        this.menu.addMenuItem(item);
        this._callbacks = [];

        defaultTeaList.sort(function(a, b) {
            return -1 * (a.time < b.time) + (a.time > b.time);
        });
        
        for ( var i = 0; i < defaultTeaList.length; i++) {
            let tea  = defaultTeaList[i];
            let item = new PopupMenu.PopupMenuItem(this._formatTime(tea.time) + " - " + tea.name);

            this._callbacks.push( function() {this._initCountdown(tea.time); });
            item.connect('activate', Lang.bind(this, this._callbacks[i]));
            this.menu.addMenuItem(item);
        }
    },
    _showNotification : function(subject, text) {
        let source = new MessageTray.Source("TeaTime applet", 'utilities-teatime');
        Main.messageTray.add(source);
        
        let notification = new MessageTray.Notification(source, subject, text);
        notification.setTransient(true);
        source.notify(notification);
    },
    _initCountdown : function(time) {
        this._startTime     = new Date();
        this._stopTime      = new Date();
        this._cntdownStart  = time;
        this._progress      = 0;
        this._stopTime.setTime(this._startTime.getTime() + time*1000); // in msec 

        this.actor.remove_actor(this._logo);         // show timer instead of default icon
        this.actor.add_actor(this._timer);

        this._showNotification("Timer set!", time + "s to go");
        this._idleTimeout = Mainloop.timeout_add_seconds(this._dt, Lang.bind(this, this._doCountdown));
    },
    _getRemainingSec: function() {
        let a = new Date();
        return (this._stopTime.getTime() - a.getTime()) * 1e-3;
    },
    _doCountdown : function() {
        let remainingTime = this._getRemainingSec(); 
        this._progress    = (this._cntdownStart - remainingTime) / this._cntdownStart;

        if (remainingTime <= 0) {
            // count down finished, switch display again
            this.actor.remove_actor(this._timer);
            this.actor.add_actor(this._logo);
            this._showNotification("Your tea is ready!",
                    "Drink it, while it is hot!");
            this._idleTimeout = null;
            return false;
        } else {
            this._timer.queue_repaint();
            return true; // continue timer
        }
    },
    _drawTimer : function() {
        let[width, height] = this._timer.get_surface_size();
        let cr = this._timer.get_context();
        let pi = Math.PI;
        let  r = Math.min(width, height) * 0.5;;

        // TODO: get colors from current theme!
        cr.setSourceRGB(0, 0, 0);
        cr.rectangle(0, 0, width, height);
        cr.fill();

        cr.translate(Math.floor(width / 2), Math.floor(height / 2));
        cr.save();

        cr.setSourceRGB(0.2, 0.2, 0.2);
        cr.moveTo(0, 0);
        cr.arc(0, 0, r, 3 / 2 * pi + 2 * pi * this._progress, 3 / 2 * pi + 2
                * pi);
        cr.fill();

        cr.setSourceRGB(0.8, 0.8, 0.8);
        cr.moveTo(0, 0);
        cr.arc(0, 0, r, 3 / 2 * pi, 3 / 2 * pi + 2 * pi * this._progress);
        cr.fill();
    }
});

function init(metadata) {
    // TODO: at some point, add translations
    ;
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
