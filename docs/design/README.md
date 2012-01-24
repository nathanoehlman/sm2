# Steelmesh Design

This repository contains information on a number of key aspects of the Steelmesh overall architecture.

## Concept Diagram

The diagram below shows a very simple concept diagram that illustrates how Steelmesh as a solution is designed, and the relationship between Steelmesh and CouchDB.

![](/steelmesh/steelmesh-design/raw/master/docs/publish-process.png)

As shown in the diagram above, there are a few key points:

- There is no direct interaction between the Steelmesh deployment tools and the Steelmesh server.
- All operations are directed at a CouchDB flavoured RESTful interface.

## Document Sections

- [Steelmesh Apps](/steelmesh/steelmesh-design/tree/master/app)
- [HTTP Interaction](/steelmesh/steelmesh-design/tree/master/http)
