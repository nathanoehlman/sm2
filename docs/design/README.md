# Steelmesh Design

This repository contains information on a number of key aspects of the Steelmesh overall architecture.

## Concept Diagram

The diagram below shows a very simple concept diagram that illustrates how Steelmesh as a solution is designed, and the relationship between Steelmesh and CouchDB.

![](/sidelab/sm2/raw/master/docs/design/_diagrams/publish-process.png)

As shown in the diagram above, there are a few key points:

- There is no direct interaction between the Steelmesh deployment tools and the Steelmesh server.
- All operations are directed at a CouchDB flavoured RESTful interface.