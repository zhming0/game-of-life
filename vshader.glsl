#version 100

attribute vec4 vertice_position;

varying vec2 xy;

void main() {
    gl_Position = vertice_position;
    xy = (vertice_position.xy + vec2(1, 1)) / 2.0;
}
