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
    const docRef = db.collection("tokens").doc(token_id);
    return await docRef.get().then((doc) => {
        if ( doc.exists ) {
            return { token_id, ... doc.data() };
        } else {
            console.log("No such token");
        }
    }).catch((error) => {
        console.log("Error getting: ", error);
    });
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
    const docRef = db.collection("users").doc(uid);
    return await docRef.get().then((doc) => {
        if ( doc.exists ) {
            return { uid, ...doc.data()}
        } else {
            console.log("No such user");
        }
    }).catch((error) => {
        console.log("Error getting: ", error);
    });
};

const handleEndAuction = async (auction) => {
  const batch = db.batch();

  const token = await getTokenById( auction.token_id );
  const seller = await getUserbyId ( token.uid );
  const buyer = await getUserbyId( auction.currentBidderUid )

  const seller_seed = seller.seed;
  const seller_sequence = seller.sequence;
  const buyer_seed = buyer.seed;
  const buyer_sequence = buyer.sequence;
  const nftoken_id = token.nftoken_id;
  const amount = auction.currentBid;

  await fetchTransferNFT(
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
      await handleEndAuction(auction);
    }
  } else {
    console.log("Nothing to do :(");
  }

  setTimeout(checkAuctions, 5000);
}

setTimeout(checkAuctions, 1000);
