==============
Events Catalog
==============

During the operation of steelmesh a number of events can be fired, these are marshalled using `piper <https://github.com/DamonOehlman/piper>` and are all namespaced in the ``steelmesh`` namespace.

Application Events
==================

Application events are emitted in the ``steelmesh.app`` namespace:

- ``steelmesh.app.load`` (id, config) - This event is fired when an application has been loaded by the application loader.

- ``steelmesh.app.reload`` (id, config) - This event is fired when an application requires a restart.  This can be activated from the dashboard manually and is also triggered when an application update is captured in the monitor process.

- ``steelmesh.app.ready.%id%`` (id, config) - This event is fired when an application has been started successfully.