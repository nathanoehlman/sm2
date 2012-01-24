# Steelmesh Application Format

A steelmesh application is made up of the following files:

```
- package.json (Application Definition File)
|- app/        (Server Side Application Files)
|- static/     (Static Resources)
```

## Package Data File (package.json)

Steelmesh uses a `package.json` file very similar to the [NPM](http://npmjs.org/) `package.json` file.  When building a NodeJS steelmesh application, the file can be constructed to exactly the same spec as you would with NPM.  When building an application for one of the other Steelmesh supported languages (coming soon), then ensure the `platform` property is defined and contains the correct value.

A barebones example `package.json` file is shown below:

```
{
    "name": "package-name",
    "description": "Brief Description",
    "author": "Author Name <author.email@company.com>",
    "version": "0.1.1"
}
```

The contents of the `package.json` file is what becomes the content of the document in CouchDB, while application files are attached to the document as CouchDB attachments.

## Other Configuration Files

### changes.json

To be completed

### jobs.json

To be completed

## Static Attachments

In addition to the application attachments that will be deployed to the server-side for execution, client-side resources can be provided as part of an application.  These files are defined in a `static/` folder within the application directory, but are packaged a little differently with regards to the couch attachments.

Static files are attached to Couch as standard attachments and thus can be accessed through the Couch HTTP interface.

## Application Attachments

Application files are in the application path that are not either a configuration file, or in the static folder.  These application files are handled and packaged in different ways depending on the steelmesh application extension.

## Application Mountpoints

By default, applications are mounted on the steelmesh server with their appname as the mountpoint.  For instance, the application defined in the package.json file above would be available at:

`http://server/package-name/*`

In some cases, it might be desirable to have an application mounted at a different url than it's package name.  In these cases, the optional `mountpoint` package attribute should be used to specify the application mount point, e.g.

```
{
    "name": "package-name",
    "description": "Brief Description",
    "author": "Author Name <author.email@company.com>",
    "version": "0.1.1",
    "mountpoint": "test"
}
```

Deploying an application with this configuration means that it will be mapped to the `/test` folder rather than the `/package-name` folder.
