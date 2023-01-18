import admin from "firebase-admin";
import { getFirestore } from "firebase-admin/firestore";

import serviceAccount from "./serviceAccountKey.json" assert { type: "json" };

const API_URL = process.env.API_URL
  ? process.env.API_URL
  : "http://localhost:8000";


admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = getFirestore();

const fetchApi = (url, method = "GET", body) => {
    console.log(JSON.stringify(body));
    return fetch(url, {
      method,
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error(response.statusText);
        }
        return response.json();
      });
};


const getTokenById = async (token_id) => {
    const docSnap = db.collection("tokens").doc(token_id).get();
    if (docSnap.exists()) {
      return { token_id, ...docSnap.data() };
    }
    throw Error("No Token with That Id");
  };

const fetchTransferNFT = async (
    seller_seed,
    seller_sequence,
    buyer_seed,
    buyer_sequence,
    nftoken_id,
    amount
    ) => {
    const data = await fetchApi(`${API_URL}/transfer-nft`, "POST", {
        seller_seed,
        seller_sequence,
        buyer_seed,
        buyer_sequence,
        nftoken_id,
        amount,
    });
    return { data, returnCode: "200" }

};

const getUserbyId = async ( uid ) => {
    const docSnap = db.collection("users").doc(uid).get();
    if ( docSnap.exists()) return { uid, ...(docSnap.data() )};
    throw Error("No User with That Id");
}

const handleEndAuction = async (auction) => {
  const batch = db.batch();

  const seller_seed = getUserbyId(getTokenById(auction.token_id).uid).seed;
  const seller_sequence = getUserbyId(getTokenById(auction.token_id).uid).sequence;
  const buyer_seed = getUserbyId(auction.currentBidderUid).seed;
  const buyer_sequence = getUserbyId(auction.currentBidderUid).sequence;
  const nftoken_id = auction.token_id;
  const amount = auction.currentBid;

  fetchTransferNFT(
    seller_seed,
    seller_sequence,
    buyer_seed,
    buyer_sequence,
    nftoken_id,
    amount,
  );


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

  setTimeout(checkAuctions, 5000);
}

setTimeout(checkAuctions, 1000);
