# Workspace Matrix

GNOME shell extension to arrange workspaces in a two dimensional grid with workspace thumbnails.

<p align="center">
   <img src="preview.png" alt="Preview">
</p>
<p align="center">
   <sup>Theme: <a href="https://github.com/mzur/Numix-Complement">Numix-Complement</a></sup>
</p>

This is a clone of the [Workspace Grid](https://github.com/zakkak/workspace-grid) extension. I was not able to wrap my head around Workspace Grid so I started to implement my own extension to get the features I wanted.

## Features

- Configurable number of rows and columns of the workspace grid.
- Workspace thumbnails with live previews of the workspaces (optional).
- Configurable scale of the workspace thumbnails.
- Configurable timeout of the workspace switcher popup.
- Two wraparound modes for navigating workspaces (optional).
- Workspace labels in the workspace switcher popup (optional).
- Workspace overview on <kbd>Super</kbd>+<kbd>W</kbd>.
- Workspace switcher popup on all monitors (optional).
- Workspace grid in the activity overview (optional).

## Installation

[<img src="https://raw.githubusercontent.com/andyholmes/gnome-shell-extensions-badge/master/get-it-on-ego.svg?sanitize=true" height="100">](https://extensions.gnome.org/extension/1485/workspace-matrix/)

The easiest way to install this extension is via the [GNOME Shell Extensions](https://extensions.gnome.org/extension/1485/workspace-matrix/) website.

### Installation on Arch Linux

If you are using Arch Linux feel free to use this AUR.

https://aur.archlinux.org/packages/gnome-shell-extension-workspace-matrix/

```
git clone https://aur.archlinux.org/gnome-shell-extension-workspace-matrix.git
cd gnome-shell-extension-workspace-matrix
makepkg -sri
```

## Known Issues / FAQ

- **extensions.gnome.org shows ERROR after an update of this extension:**
   Restart GNOME Shell by pressing <kbd>Alt</kbd>+<kbd>F2</kbd> and running the `r` command. ([#52](https://github.com/mzur/gnome-shell-wsmatrix/issues/52))
- **My windows jump between workspaces after the machine was locked or suspended:**
   Disable the extension, set workspaces to "static" in GNOME Tweaks and then enable this extension again. ([#29](https://github.com/mzur/gnome-shell-wsmatrix/issues/29))
- **How do I change the keyboard shortcuts?**
   Take a look at the [wiki](https://github.com/mzur/gnome-shell-wsmatrix/wiki/Custom-keyboard-shortcuts) for the available shortcuts of this extension and how to change them.
- **How do I change the workspace labels?**
  Take a look at the [wiki](https://github.com/mzur/gnome-shell-wsmatrix/wiki/Assigning-custom-labels-to-workspaces) for a how-to.

## Contributing

Pull requests for issues that are marked as "bug" or "help wanted" are always welcome. If you want to implement any other new feature, please open an issue about this first. See the next section on how to get started with development.

If you want to report a bug, please attach the output of the command `journalctl /usr/bin/gnome-shell`.

## Developing

You can develop this extension "live" while it is installed in GNOME on your system:

1. Uninstall this extension if it is already installed. You can do this via the [GNOME Shell Extensions](https://extensions.gnome.org/extension/1485/workspace-matrix/) website.
2. Fork this repository and clone your fork somewhere, e.g. to `~/code/gnome-shell-workspace-matrix`.
3. Create a symlink from the repository to the GNOME extensions directory, e.g.:
   ```
   ln -s ~/code/gnome-shell-workspace-matrix/wsmatrix@martin.zurowietz.de ~/.local/share/gnome-shell/extensions/wsmatrix@martin.zurowietz.de
   ```
4. Restart GNOME by pressing <kbd>Alt</kbd>+<kbd>F2</kbd> and running the command `r` (X.org) or log out and back in (Wayland). Do this whenever you want to apply and test a change of the code.

If you change something in the gschema XML file, run `make` to recompile it. The `make` command also builds the ZIP file that can be used for new releases of this extension.
