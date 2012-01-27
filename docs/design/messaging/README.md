# Steelmesh Messaging

Steelmesh messaging is used to facilitate communication between a variety of components.  Firstly we have in-process messaging between the core runtime, monitor and dashboard and secondly we have inter-process messaging (via Redis) between the core runtime and the proxy layer.

In both cases, messaging is facilitated by the [sleeve](https://github.com/sidelab/sleeve) library which is simply a wrapper to [eve](https://github.com/DmitryBaranovskiy/eve) messaging.

## Core Messages

### sm.app.init

This message is fired in two cases:

1. Steelmesh is starting and the application has been found in the current list of applications.

2. An application update has been received.

In both cases, the event is trigger __after__ application files have been updated on the file system.

The body of the message is the application definition as stored in couch, with a few of the extra bits and pieces removed.

```json
{
    "id": "appid",
    ...
}
```

### sm.shutdown

This message is fired when the Steelmesh platform is being shutdown.

```json
{
    "apps": "*"
}
```