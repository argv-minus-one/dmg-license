# Raw Labels Format

A [set of `rawLabels` in a license specification](License%20Specifications.md#rawlabelsn) must be a file in a special binary format. This document explains that format.

When `DiskImageMounter` goes to mount a disk image and notices that there is a license agreement to display, in addition to looking for the license text, it also looks for a resource in the disk image of type `STR#` with the appropriate ID. This resource contains a list of six Pascal-style (length-prefixed) strings, which will be displayed on the license agreement window as labels for the buttons and other controls.

The strings are, in order:

1. Name of the language. (Modern macOS seems to ignore this.)
2. Label for “agree” button.
3. Label for “disagree” button.
4. Label for the “print” button.
5. Label for the “save” button.
6. Brief instructions for the user, displayed on the left side of the window alongside the license text.

The specific format of the `STR#` resource is:

1. The quantity of strings in the list (unsigned 16-bit integer, big endian). Must be 6.
2. A sequence of:
	1. The length of the following string, in bytes (unsigned 8-bit integer).
	2. The bytes of the string, in the appropriate classic Mac OS character set.
