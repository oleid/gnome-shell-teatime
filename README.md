**Premise**

Before you do anything, please make sure, that you have the following packages installed:

 - libglib2.0-dev
 - intltool
 - gnome-common
 
The name of the package may vary from distribution to distributon. The first two packages provide m4-files needed for the generation of the configure script. The files in need are:

- intltool.m4
- gsettings.m4

They should be located somewhere in `/usr/share/aclocal`.

**Installaton**

If everything is in place, run

    ./autogen.sh

to generate the configure script. If everything worked well, do:

    ./configure --prefix=/usr && make

To install the extension to your home directory, run:

    make local-install

Or to install it for all users you need administrator rights. Thus you've to use something like sudo or become root via su. Using sudo, simply run:

    sudo make install

In case you can't find the applet in gnome-tweak-tool, restart gnome-shell (using <kbd>Alt</kbd>
+<kbd>F2</kbd>, enter: <kbd>r</kbd>).

If you wish to translate TeaTime to your language, have a look at the directory `po`.

A handy zip file can be created using:

    make zip   # This is the same you get via http://extensions.gnome.org


Thanks to  Thomas Liebetraut for the new build system.
Get the latest version from:  https://github.com/tommie-lie/gnome-shell-extensions-template

**Contribution**

Patches are welcome. But please make sure the code you contribute is formated properly.
Please run `beautify-code.sh` before sending pull requests. Therefore, you'll need to install the
python tool `js-beautify`, e.g. via `pip install jsbeautifier`.
