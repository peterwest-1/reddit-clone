# Reddit Clone

## Tech Stack

## Notes

Change sendEmail in forgotPassword in User resolver

### Useful commands

npx typeorm migration:generate -n Initial
npx typeorm migration:create -n MockPosts

### Sessions

req.session.userId = user.id;

{
userId:
} - sends to Redis, key value store

qweqweqe is the key
sess: qweqweqe -> {userId: 1}

express-session will set a cookie on browser i.e. werwerwerwrwerwerwr, (signed of qweqweqe, kinda)
when user mames a request - >
werwerwerwrwerwerwr -> sent to the server

werwerwerwrwerwerwr -> unsigns/decrypt with secret => sess: qweqweqe

make a request to redis
sess: qweqweqe -> {userId: 1} uses key to get data
