# Steelmesh HTTP Interaction Overview

Steelmesh is designed to be a high-performance web application stack, and as such uses application components that are __best fit for purpose__ in the solution architecture.

While Steelmesh is a Node.js application, it has been designed to serve static content as efficiently as possible.  If nginx has been configured as part of a steelmesh appliance, then nginx should serve static resources rather than push the requests through the backend services.

The diagram below illustrates this concept at a high level:

![](/steelmesh/steelmesh-design/raw/master/docs/http-pathing.png)

Additionally, we can see in the diagram that if the first services layer does not successfully handle the request (see below for codes that qualify for pass-on response logic), then the request is pushed to the next service in the list.

Finally if no services successfully deal with the request, that request is passed through to CouchDB before finally a 404 response is generated.