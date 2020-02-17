/*********************************************************************
 * A small custom icon class, which draws a two bit icon centered and
 * maximized, preserving the aspect ratio.
 *
 * This class was introduced to solve the following problems:
 *  a) draw the icon with the current theme color
 *  b) to work-around the strange streched icon I get in gnome-3.14
 *  c) draw an animation using current theme color
 *
 * If there is a better way for that stuff, please let me know ;)
 ********************************************************************/

const GObject = imports.gi.GObject;
const St = imports.gi.St;
const Clutter = imports.gi.Clutter;
const ExUt = imports.misc.extensionUtils;
const Me = ExUt.getCurrentExtension();
const Utils = Me.imports.utils;

var TwoColorIcon = GObject.registerClass(
class TwoColorIcon extends St.DrawingArea {
	_init(size, drawingObject) {
		super._init({
			reactive: true,
			style: 'padding: 0px 0px'
		});
			this._base_size = size;
			//this.setScaling(Utils.getGlobalDisplayScaleFactor());

			this._drawingObject = drawingObject;

			this.connect('repaint', function () {
				this._drawIcon();
			}.bind(this));

			// some fallback color
			this._primaryColor = new Clutter.Color({
				red: 150,
				green: 150,
				blue: 150,
				alpha: 255
			});
			this._secundaryColor = this._primaryColor;
			this._customStatus = null;
	}

	setPadding(padding) {
			this.margin_left = padding;
			this.margin_right = padding;
	}

	setColor(primary, secundary) {
			this._primaryColor = primary;
			this._secundaryColor = secundary;
			this.queue_repaint();
	}

	setScaling(newScale) {
			this._default_scale = newScale;
			this.set_width(this._base_size * this._default_scale);
			this.set_height(this._base_size * this._default_scale);
			this.queue_repaint();
	}

	setStatus(newStatus) {
			this._customStatus = newStatus;
			this.queue_repaint();
	}

	_drawIcon() {
			let cr = this.get_context();
			let orWdt = this._drawingObject.width;
			let orHgt = this._drawingObject.height;
			let [width, height] = this.get_surface_size();

			cr.save();

			let object_longest_edge = Math.max(orWdt, orHgt);
			let surface_shortest_edge = Math.min(width, height);
			let scaling = surface_shortest_edge / object_longest_edge;
			let padding_x = (width - orWdt * scaling) * 0.5;
			let padding_y = (height - orHgt * scaling) * 0.5;

			cr.translate(padding_x, padding_y);
			try {
				cr.scale(scaling, scaling);

				this._drawingObject.draw(cr, this._customStatus, this._primaryColor, this._secundaryColor);

				cr.restore();
			} catch (e) {
				// ignore
			}
	}
});

var TeaPot = {
	width: 484,
	height: 295,
	draw(cr, stat, primary, secundary) {
		// draw TeaPot
		// cairo commands generated from svg2cairo
		// https://github.com/akrinke/svg2cairo

		Utils.setCairoColorFromClutter(cr, primary);

		cr.moveTo(127.894531, 276.472656);
		cr.curveTo(98.457031, 244.316406, 76.527344, 238.09375, 47.953125, 210.996094);
		cr.curveTo(17.957031, 186.902344, -7.5625, 148.257812, 2.066406, 108.261719);
		cr.curveTo(6.914062, 83.1875, 33.097656, 66.261719, 57.921875, 71.910156);
		cr.curveTo(75.457031, 74.132812, 91.273438, 82.546875, 106.296875, 91.351562);
		cr.curveTo(115.582031, 75.792969, 143.570312, 72.222656, 134.984375, 50.113281);
		cr.curveTo(148.652344, 38.449219, 169.386719, 38.300781, 186.574219, 34.550781);
		cr.curveTo(194.753906, 31.46875, 224.667969, 35.746094, 204.664062, 27.492188);
		cr.curveTo(191.921875, 8.488281, 224.023438, -2.769531, 239.1875, 0.589844);
		cr.curveTo(266.851562, -1.550781, 262.417969, 31.988281, 246.710938, 32.113281);
		cr.curveTo(277.785156, 34.632812, 309.761719, 36.359375, 339.148438, 47.523438);
		cr.curveTo(349.664062, 56.277344, 334.71875, 72.871094, 353.0625, 77.5625);
		cr.curveTo(365.789062, 87.367188, 373.671875, 119.875, 391.816406, 97.292969);
		cr.curveTo(408.726562, 84.214844, 418.597656, 56.902344, 444.113281, 60.386719);
		cr.curveTo(455.804688, 60.738281, 498.675781, 59.714844, 478.949219, 78.144531);
		cr.curveTo(459.007812, 90.46875, 438.289062, 106.699219, 434.382812, 131.382812);
		cr.curveTo(424.910156, 164.207031, 403.375, 177.308594, 377.503906, 202.261719);
		cr.curveTo(356.9375, 218.46875, 366.351562, 240.726562, 316.707031, 285.832031);
		cr.curveTo(289.941406, 297.757812, 175.589844, 302.082031, 127.894531, 276.472656);
		cr.closePath();
		cr.moveTo(83.28125, 184.4375);
		cr.curveTo(78.351562, 164.75, 89.941406, 143.515625, 85.308594, 124.882812);
		cr.curveTo(73.085938, 112.210938, 40.816406, 104.996094, 44.332031, 130.574219);
		cr.curveTo(48.808594, 142.773438, 71.621094, 185.558594, 83.28125, 184.4375);
		cr.closePath();
		cr.moveTo(83.28125, 184.4375);
		cr.setTolerance(0.1);
		cr.fillPreserve();

		// end of image
	} // draw
}; // TeaPot


var Pie = {
	width: 1,
	height: 1,
	draw(cr, stat, primary, secundary) {
		const pi = Math.PI;
		const r = 0.5;

		if (stat == null) stat = 0;

		cr.translate(0.5, 0.5);
		cr.save();

		Utils.setCairoColorFromClutter(cr, secundary);
		cr.moveTo(0, 0);
		cr.arc(0, 0, r, 3 / 2 * pi + 2 * pi * stat, 3 / 2 * pi + 2 *
			pi);
		cr.fill();

		Utils.setCairoColorFromClutter(cr, primary);
		cr.moveTo(0, 0);
		cr.arc(0, 0, r, 3 / 2 * pi, 3 / 2 * pi + 2 * pi * stat);
		cr.fill();
		cr.restore();
	} // draw
}; // Pie
