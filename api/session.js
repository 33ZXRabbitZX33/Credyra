const { verifySession } = require('./_auth');

module.exports = async (req, res) => {
  const session = verifySession(req);
  res.status(200).json({ loggedIn: !!session, username: session ? session.u : null });
};
