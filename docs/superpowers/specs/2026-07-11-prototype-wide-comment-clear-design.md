# Prototype-wide Comment Clear Design

## Problem

The presentation toolbar's `clear-edits` action currently clears only records whose
`pageScope` matches the mounted page. Records for other pages in the same
`.spec/prototype-comments.json` document are deliberately preserved, so the visible
"清空" command does not match the prototype-wide behavior of "复制提示词".

## Required Behavior

- The presentation toolbar's "清空" command clears pending comments for every page
  in the currently selected prototype.
- The clear removes the prototype comment document's `comments`, `tasks`, and
  associated `images` across all page scopes.
- The mounted page still reverts its visible pending text, style, tweak, and comment
  state before the persisted document is cleared.
- Other prototypes remain untouched because persistence stays scoped to the current
  `prototypes/<id>` target path.
- The confirmation text explicitly says that all pages in the current prototype will
  be cleared.

## Design

Extend the existing `clear-edits` action and local clear configuration with an
explicit prototype-wide scope. The presentation toolbar sends that scope. The editor
continues to use the existing clear pipeline for the mounted page, then asks the
persistence service to clear all page scopes.

The persistence layer remains the owner of document merging. For a prototype-wide
clear it writes a valid empty `prototype-edit-comments` document with empty
`comments`, `tasks`, and `images`, instead of preserving records from non-current
page scopes. Existing current-page clear behavior remains available to callers that
do not request prototype scope.

This is preferred over having the Make parent write the JSON directly, because the
editor must also revert its mounted DOM and local runtime state. It is also preferred
over loading every page and clearing each iframe, because unmounted pages are already
represented in the shared persisted document and do not need to be rendered.

## Error Handling

The existing persistence adapter remains responsible for reporting write failures.
The action must not target a broader project path or enumerate other prototypes.
Malformed or unavailable persistence scope continues to follow existing no-op/error
handling rather than falling back to a project-wide delete.

## Tests

- Add a persistence regression test with comments, tasks, and images from two page
  scopes; prototype-wide clear must write an empty document.
- Verify current-page clear still preserves records from the other page when no
  prototype-wide scope is requested.
- Verify the presentation toolbar dispatches prototype-wide clear and displays the
  explicit prototype-wide confirmation language.
- Run the focused commentary and Make toolbar/bridge tests, followed by the relevant
  workspace test command and type/build verification defined by the package scripts.
