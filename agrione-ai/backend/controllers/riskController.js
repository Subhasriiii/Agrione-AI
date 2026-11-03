const { assessRisk } = require('../ml/risk_assessment/service');

exports.assess = async (req, res) => {
  try {
    const result = assessRisk(req.body);
    res.json({ success: true, risk: result });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Risk assessment failed.' });
  }
};
