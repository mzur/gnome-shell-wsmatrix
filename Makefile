UUID=wsmatrix@martin.zurowietz.de

default: clean schemas zip

clean:
	find -name 'gschemas.compiled' -o -name $(UUID).zip -delete

zip:
	cd $(UUID) && zip -r ../$(UUID).zip *

schemas:
	find -name 'schemas' -type d -exec glib-compile-schemas {} \;

# Run a nested GNOME Shell window with the freshly built extension (needs mutter-devkit).
test: default
	gnome-extensions install --force $(UUID).zip
	MUTTER_DEBUG_DUMMY_MODE_SPECS=1600x900 dbus-run-session gnome-shell --devkit --wayland
