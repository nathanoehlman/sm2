# Jailing Subprocesses

One of the techniques used in Nodejitsu's [haibu-carapace](https://github.com/nodejitsu/haibu-carapace) is using `chroot` to isolate a processes view of the file system.  Seems reasonably effective.

The [node-posix](https://github.com/melor/node-posix) module seems to offer one of the lightest weight implementations that provides access to the `chroot` functionality.  Obviously, if we do go down this path it will mean that this won't work on Windows systems.

## Additional Reading

Some useful reference links are available on the node-posix readme page:

