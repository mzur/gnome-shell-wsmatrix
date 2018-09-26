UUID=wsmatrix@martin.zurowietz.de

default: clean schemas zip

clean:
	find -name 'gschemas.compiled' -o -name $(UUID).zip -delete

zip:
	cd $(UUID) && zip -r ../$(UUID).zip *

schemas:
	find -name 'schemas' -type d -exec glib-compile-schemas {} \;
