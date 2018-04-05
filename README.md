[![Build Status](https://travis-ci.org/DFE-Digital/login.dfe.osa-api.svg?branch=master)](https://travis-ci.org/DFE-Digital/login.dfe.osa-api)

# DfE OSA API

API use to authenticate user details against OSA db


###Endpoints

```
authenticate


POST
/authenticate
``` 
``` 
body:

{
    "username": "user1",
    "password": "my-password"
}
``` 
``` 
returns

{
    "firstName":"Test",
    "lastName":"Tester",
    "email":"Test"
}
``` 

