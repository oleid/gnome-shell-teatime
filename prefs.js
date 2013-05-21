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
        this._inhibitUpdate = true;
        this._settings.connect("changed::" + SETTINGS_TEALIST_KEY, Lang.bind(this, this._refresh));
        
        this._initWindow();
        this.vexpand = true;
        this._inhibitUpdate = false;
        this._refresh();
        this._tealist.connect("row-changed", Lang.bind(this, this._save));
        this._tealist.connect("row-deleted", Lang.bind(this, this._save));
    },
    _initWindow: function() {
        this.treeview = new Gtk.TreeView({model: this._tealist, expand: true});
        this.treeview.get_selection().set_mode(Gtk.SelectionMode.MULTIPLE);
        this.add(this.treeview);
        
        let teaname = new Gtk.TreeViewColumn({ title: _("Tea"), expand: true });
        let renderer = new Gtk.CellRendererText({ editable: true });
        // When the renderer is done editing it's value, we first write
        // the new value to the view's model, i.e. this._tealist.
        // This makes life a little harder due to chaining of callbacks
        // and the need for this._inhibitUpdate, but it feels a lot cleaner
        // when the UI does not know about the config storage backend.
        renderer.connect("edited", Lang.bind(this, function(renderer, pathString, newValue) {
            let [store, iter] = this._tealist.get_iter(Gtk.TreePath.new_from_string(pathString));
            this._tealist.set(iter, [0], [newValue]);
        }));
        teaname.pack_start(renderer, true);
        teaname.add_attribute(renderer, "text", 0);
        this.treeview.append_column(teaname);        
        
        let steeptime = new Gtk.TreeViewColumn({ title: _("Steep time"), min_width: 150 });
        let spinrenderer = new Gtk.CellRendererSpin({ editable: true });
        // See comment above.
        spinrenderer.connect("edited", Lang.bind(this, function(renderer, pathString, newValue) {
            let [store, iter] = this._tealist.get_iter(Gtk.TreePath.new_from_string(pathString));
            this._tealist.set(iter, [1], [parseInt(newValue)]);
        }));

        steeptime.pack_start(spinrenderer, true);
        steeptime.add_attribute(spinrenderer, "adjustment", 2);
        steeptime.add_attribute(spinrenderer, "text", 1);
        this.treeview.append_column(steeptime);


        this.toolbar = new Gtk.Toolbar({ icon_size: 1 });
        this.toolbar.get_style_context().add_class("inline-toolbar");
        this.add(this.toolbar);
        this.addButton = new Gtk.ToolButton({ icon_name: "list-add-symbolic", use_action_appearance: false });
        this.addButton.connect("clicked", Lang.bind(this, this._addTea));
        this.toolbar.insert(this.addButton, -1);
        this.removeButton = new Gtk.ToolButton({ icon_name: "list-remove-symbolic", use_action_appearance: false });
        this.removeButton.connect("clicked", Lang.bind(this, this._removeSelectedTea));
        this.toolbar.insert(this.removeButton, -1);
    },
    _refresh: function() {
        // don't update the model if someone else is messing with the backend
        if (this._inhibitUpdate)
            return;

        let list = this._settings.get_value(SETTINGS_TEALIST_KEY);

        // stop everyone from reacting to the changes we are about to produce
        // in the model
        this._inhibitUpdate = true;

        this._tealist.clear();
        for (let i = 0; i < list.n_children(); ++i) {
            let item = list.get_child_value(i);
            let teaname = item.get_child_value(0).get_string()[0];
            let time = item.get_child_value(1).get_uint32();
            
            let adj = new Gtk.Adjustment({ lower: 1, step_increment: 1, upper: 65535, value: time });
            this._tealist.set(this._tealist.append(), [0, 1, 2], [teaname, time, adj]);
        }

        this._inhibitUpdate = false;
    },
    _addTea: function() {
        let adj = new Gtk.Adjustment({ lower: 1, step_increment: 1, upper: 65535, value: 1 });
        let item = this._tealist.append();
        this._tealist.set(item, [0, 1, 2], ["", 1, adj]);
        this.treeview.set_cursor(this._tealist.get_path(item), this.treeview.get_column(0), true);
    },
    _removeSelectedTea: function() {
        let [selection, store] = this.treeview.get_selection().get_selected_rows();
        let iters = [];
        for (let i = 0; i < selection.length; ++i) {
            let [isSet, iter] = store.get_iter(selection[i]);
            if (isSet) {
                iters.push(iter);
            }
        }
        // it's ok not to inhibit updates here as remove != change
        iters.forEach(function(value, index, array) {
            store.remove(value) }
        );

        this.treeview.get_selection().unselect_all();
    },
    _save: function(store, path_, iter_) {
        // don't update the backend if someone else is messing with the model
        if (this._inhibitUpdate)
            return;

        let values = [];
        this._tealist.foreach(function(store, path, iter) {
            values.push(GLib.Variant.new_dict_entry(
                GLib.Variant.new_string(store.get_value(iter, 0)),
                GLib.Variant.new_uint32(store.get_value(iter, 1))))
        });
        let settingsValue = GLib.Variant.new_array(GLib.VariantType.new("{su}"), values);
        
        // all changes have happened through the UI, we can safely
        // disable updating it here to avoid an infinite loop
        this._inhibitUpdate = true;

        this._settings.set_value(SETTINGS_TEALIST_KEY, settingsValue);
        
        this._inhibitUpdate = false;
    }

});


function init() {
}

function buildPrefsWidget() {
    let widget = new TeaTimePrefsWidget();

    widget.show_all();
    return widget;
}

