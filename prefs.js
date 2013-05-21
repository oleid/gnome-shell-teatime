/* -*- mode: js2; js2-basic-offset: 4; indent-tabs-mode: nil -*- */
/* Olaf Leidinger <oleid@mescharet.de>
   Thomas Liebetraut <thomas@tommie-lie.de>
*/

const Gdk = imports.gi.Gdk;
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const GnomeDesktop = imports.gi.GnomeDesktop;
const Mainloop = imports.mainloop; // timer
const St = imports.gi.St;
const Clutter = imports.gi.Clutter;

const Lang = imports.lang;
const Gtk = imports.gi.Gtk;
const GObject = imports.gi.GObject;

const Gettext = imports.gettext.domain('gnome-shell-extensions');
const _ = Gettext.gettext;
const N_ = function(e) { return e; };

const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();

let settings;

const SETTINGS_TEALIST_KEY = 'steep-times';


function getSettings(schema) {
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
                                                 }
    else
        schemaSource = GioSSS.get_default();

    let schemaObj = schemaSource.lookup(schema, true);
    if (!schemaObj)
        throw new Error('Schema ' + schema + ' could not be found for extension '
                        + extension.metadata.uuid + '. Please check your installation.');

    return new Gio.Settings({ settings_schema: schemaObj });
}

const TeaTimePrefsWidget = new Lang.Class({
    Name : 'TeaTimePrefsWidget',
    Extends : Gtk.Box,
    
    _init: function() {
        this.parent({ orientation: Gtk.Orientation.VERTICAL });

        this._tealist = new Gtk.ListStore();
        this._tealist.set_column_types([GObject.TYPE_STRING, GObject.TYPE_INT, Gtk.Adjustment]);

        this._settings = getSettings();
        this._settings.connect("changed::" + SETTINGS_TEALIST_KEY, Lang.bind(this, this._refresh));
        
        this._initWindow();
        this.vexpand = true;
        this._refresh();
    },
    _initWindow: function() {
        this.treeview = new Gtk.TreeView({model: this._tealist, expand: true});
        this.add(this.treeview);
        
        let teaname = new Gtk.TreeViewColumn({ title: _("Tea"), expand: true });
        let renderer = new Gtk.CellRendererText({ editable: true });
        teaname.pack_start(renderer, true);
        teaname.add_attribute(renderer, "text", 0);
        this.treeview.append_column(teaname);        
        
        let steeptime = new Gtk.TreeViewColumn({ title: _("Steep time") });
        let spinrenderer = new Gtk.CellRendererSpin({ editable: true });
        steeptime.pack_start(spinrenderer, true);
        steeptime.add_attribute(spinrenderer, "adjustment", 2);
        steeptime.add_attribute(spinrenderer, "text", 1);
        this.treeview.append_column(steeptime);


        this.toolbar = new Gtk.Toolbar({ icon_size: 1 });
        this.toolbar.get_style_context().add_class("inline-toolbar");
        this.add(this.toolbar);
        this.addButton = new Gtk.ToolButton({ icon_name: "list-add-symbolic", use_action_appearance: false });
        this.toolbar.insert(this.addButton, -1);
        this.removeButton = new Gtk.ToolButton({ icon_name: "list-remove-symbolic", use_action_appearance: false });
        this.toolbar.insert(this.removeButton, -1);
    },
    _refresh: function() {
        this._tealist.clear();
        
        let list = this._settings.get_value(SETTINGS_TEALIST_KEY);
        for (let i = 0; i < list.n_children(); ++i) {
            let item = list.get_child_value(i);
            let teaname = item.get_child_value(0).get_string()[0];
            let time = item.get_child_value(1).get_uint32();
            
            let adj = new Gtk.Adjustment({ lower: 1, step_increment: 1, upper: 65535, value: time });
            this._tealist.set(this._tealist.append(), [0, 1, 2], [teaname, time, adj]);
        }
    }

});


function init() {
}

function buildPrefsWidget() {
    let widget = new TeaTimePrefsWidget();

    widget.show_all();
    return widget;
}

