import { createFormLifecycle } from '../../../../utils/create-form-lifecycle';

const UID = 'api::form-reservation-tour.form-reservation-tour';

export default createFormLifecycle({
  uid: UID,
  // The tour uses one template for both recipients; only the message differs.
  submitter: { template: 'reservation.html', subject: 'Reservación de Tour recibida' },
  admin: { template: 'reservation.html', subject: 'Reservación de Tour Copía' },
  buildVars: async (result) => {
    // Reservations made from a tour page send the `article` relation instead of `tourName`.
    let tourName = result.tourName;
    if (!tourName) {
      const populated = await strapi.db.query(UID).findOne({
        where: { id: result.id },
        populate: { article: true },
      });
      tourName = populated?.article?.title;
    }
    return {
      name: result.name,
      lastname: result.lastname,
      tourName,
      email: result.email,
      phone: result.phone,
      message: result.message,
      tourDate: result.tourDate,
      people: result.people,
    };
  },
});
