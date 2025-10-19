import PaymentModel from '../../models/payments/Payment.js';

export class PaymentRepository {
  async create(doc) {
    return PaymentModel.create(doc);
  }
  async findById(id) {
    return PaymentModel.findById(id).populate('paymentType');
  }
  async find(filter = {}, { page = 1, limit = 20 } = {}) {
    const q = PaymentModel.find(filter).populate('paymentType').sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit);
    const [items, total] = await Promise.all([q.lean(), PaymentModel.countDocuments(filter)]);
    return { items, total, page, limit };
  }
  async update(id, updates) {
    return PaymentModel.findByIdAndUpdate(id, updates, { new: true });
  }
  async remove(id) {
    return PaymentModel.findByIdAndDelete(id);
  }
}

export class PaymentService {
  constructor(repo = new PaymentRepository()) {
    this.repo = repo;
  }
  async getById(id) {
    return this.repo.findById(id);
  }
  async listByUser(userId, { page, limit, method, status, from, to }) {
    const filter = { 'customer.userId': userId };
  if (method) filter.paymentType = method; // method now expects PaymentType ObjectId
    if (status) filter.status = status;
    if (from || to) filter.createdAt = {};
    if (from) filter.createdAt.$gte = new Date(from);
    if (to) filter.createdAt.$lte = new Date(to);
    return this.repo.find(filter, { page, limit });
  }
  async update(id, updates) {
    return this.repo.update(id, updates);
  }
  async delete(id) {
    return this.repo.remove(id);
  }
}
