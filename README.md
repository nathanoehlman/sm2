# Steelmesh 2.0

This is the Steelmesh 2.0 project.  This is the next version of Steelmesh that takes lessons learned from a production deployment of the original [Steelmesh project](https://github.com/steelmesh/steelmesh) and makes things faster, leaner and more robust.

## Design Goals

The following is a list of features and exclusions for Steelmesh 2.0.

### Included Features

- Application distribution and monitoring of application updates via [CouchDB](http://couchdb.apache.org/)

- Steelmesh nodes are role aware and applications are loaded intelligently based on their role specification.  Applications without a specified role are loaded on all steelmesh nodes.

- 

### Exclusions

- Monitoring application updates in not handled by Steelmesh core.  If an application is using CouchDB and wants to receive application data updates, it will run up it's own instance of [ChangeMachine](https://github.com/DamonOehlman/changemachine).

### To be discussed

- NPM Support.  In the original version of Steelmesh, node_modules were packaged into the application package and pushed to CouchDB.  This does limit the ability to support packages with native bindings that need to be compiled for a specific platform.

## License

Copyright (c) 2012 Sidelab and contributors
Licensed under the Apache 2 license