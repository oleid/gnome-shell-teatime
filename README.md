To install the extension, first run

./autogen.sh

If everything worked well, do:

./configure --prefix=/usr &&
make

And as a super user, e.g. using sudo

sudo make install

Restart gnome-shell after that (using Alt+F2, enter "r" -- without quotes).

If you wish to translate TeaTime to your language, have a look at the directory "po".

A handy zip file can be created using:

make zip   -- This is the same you get via http://extensions.gnome.org


Thanks to  Thomas Liebetraut for the new build system.
Get the latest version from:  https://github.com/tommie-lie/gnome-shell-extensions-template
