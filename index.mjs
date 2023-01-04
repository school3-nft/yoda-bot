import admin from "firebase-admin";
import { getFirestore } from "firebase-admin/firestore";

import serviceAccount from "./.private/serviceAccountKey.json" assert { type: "json" };

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = getFirestore();

const getTokenById = async (token_id) => {
  const docSnap = db.collection("tokens").doc(token_id).get();
  if (docSnap.exists()) {
    return { token_id, ...docSnap.data() };
  }
  throw Error("No Token with That Id");
};

const handleEndAuction = async (auction) => {
  const batch = db.batch();

  batch.update(db.collection("tokens").doc(auction.token_id), {
    uid: auction.currentBidderUid,
  });

  batch.delete(db.collection("auctions").doc(auction.auction_id));

  batch.commit();

  console.log(
    `user with uid: ${auction.currentBidderUid} is a winner of token with id: ${auction.token_id}`
  );
};

const getEndedAuctions = async () => {
  const auctions = [];
  const querySnapshot = await db.collection("auctions").get();

  querySnapshot.forEach((doc) => {
    const date = new Date();
    const auction_id = doc.id;
    const auction = { auction_id, ...doc.data() };

    if (date > auction.endDate.toDate()) auctions.push(auction);
  });

  return auctions;
};

async function checkAuctions() {
  const endedAuctions = await getEndedAuctions();
  if (endedAuctions.length !== 0) {
    for (let auction of endedAuctions) {
      handleEndAuction(auction);
    }
  } else {
    console.log("Nothing to do :(");
  }

  setTimeout(checkAuctions, 50000);
}

setTimeout(checkAuctions, 50000);
