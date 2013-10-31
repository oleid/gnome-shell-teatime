/* -*- mode: js2; js2-basic-offset: 4; indent-tabs-mode: nil -*- */
/* Olaf Leidinger <oleid@mescharet.de>
   Thomas Liebetraut <thomas@tommie-lie.de>
*/

const Gio = imports.gi.Gio;
const Lang = imports.lang;

const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();

const TEATIME_STEEP_TIMES_KEY = 'steep-times';

function bindTextDomain() {
    // Evil hack to check, if extension is globally installed. 
    // If it is, we may not bind to the text domain, as the translation won't 
    // be found
    if( Me.dir.get_path() != "/usr/share/gnome-shell/extensions/TeaTime@oleid.mescharet.de" ) {
        Gettext.bindtextdomain("TeaTime", Me.dir.get_path() + "/locale");
    }
}

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
    } else {
        schemaSource = GioSSS.get_default();
    }

    let schemaObj = schemaSource.lookup(schema, true);
    if (!schemaObj)
        throw new Error('Schema ' + schema + ' could not be found for extension '
                        + extension.metadata.uuid + '. Please check your installation.');

    return new Gio.Settings({ settings_schema: schemaObj });
}

function formatTime(seconds) {
    let a = new Date(0,0,0); // important: hour needs to be set to zero in _locale_ time

    a.setTime(a.getTime()+ seconds * 1000); // set time in msec, adding the time we want

    if (seconds > 3600)
        return a.toLocaleFormat("%H:%M:%S");
    else
        return a.toLocaleFormat("%M:%S");
}
