#version 100

attribute vec4 vertice_position;

uniform float cell_width;
uniform float cell_height;
uniform mat4 transform;

varying float w, h;
varying vec2 xy;
varying vec2 neighbors[8];

void main() {
    gl_Position = transform * vertice_position;
    xy = (vertice_position.xy + vec2(1.0, 1.0)) * 0.5;

    neighbors[0] = vec2(cell_width, cell_height);
    neighbors[1] = vec2(-cell_width, -cell_height);
    neighbors[2] = vec2(cell_width, -cell_height);
    neighbors[3] = vec2(-cell_width, cell_height);
    neighbors[4] = vec2(0, cell_height);
    neighbors[5] = vec2(cell_width, 0);
    neighbors[6] = vec2(0, -cell_height);
    neighbors[7] = vec2(-cell_width, 0);

    w = cell_width;
    h = cell_height;
}
