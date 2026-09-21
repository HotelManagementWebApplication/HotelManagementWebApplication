package com.hospitality.mis.service.finance;

import com.hospitality.mis.common.exception.DomainException;
import com.hospitality.mis.dto.finance.CommercialDtos;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Service
public class CommercialPartnerService {
    private final JdbcTemplate jdbc;

    public CommercialPartnerService(JdbcTemplate jdbc) { this.jdbc = jdbc; }

    @Transactional(readOnly = true)
    public List<CommercialDtos.SpaceResponse> spaces() {
        return jdbc.query("""
                SELECT s.id, s.partner_id, p.brand_name, s.name, s.floor, s.zone, s.access_policy, s.service_id
                FROM commercial_spaces s JOIN commercial_partners p ON p.id=s.partner_id
                WHERE s.status='ACTIVE' AND p.status='ACTIVE' ORDER BY s.floor, s.name
                """, (rs, n) -> new CommercialDtos.SpaceResponse(rs.getString(1), rs.getString(2), rs.getString(3),
                rs.getString(4), rs.getInt(5), rs.getString(6), rs.getString(7), rs.getString(8)));
    }

    @Transactional(readOnly = true)
    public List<CommercialDtos.PartnerResponse> partners() {
        return jdbc.query("SELECT id, legal_name, brand_name, category, floor_from, floor_to, fixed_rent, service_fee, commission_rate, commission_floor, status FROM commercial_partners ORDER BY floor_from, brand_name",
                (rs, n) -> new CommercialDtos.PartnerResponse(rs.getString(1), rs.getString(2), rs.getString(3), rs.getString(4),
                        rs.getInt(5), rs.getInt(6), rs.getBigDecimal(7), rs.getBigDecimal(8), rs.getBigDecimal(9), rs.getBigDecimal(10), rs.getString(11)));
    }

    @Transactional(readOnly = true)
    public List<CommercialDtos.SettlementResponse> settlements() {
        return jdbc.query("""
                SELECT s.id, s.partner_id, p.brand_name, s.period_start, s.period_end, s.fixed_rent, s.service_fee,
                       s.actual_revenue, s.commission_rate, s.commission_floor, s.commission_due, s.total_due, s.status
                FROM partner_monthly_settlements s JOIN commercial_partners p ON p.id=s.partner_id
                ORDER BY s.period_start DESC, p.brand_name
                """, (rs, n) -> new CommercialDtos.SettlementResponse(rs.getLong(1), rs.getString(2), rs.getString(3),
                rs.getDate(4).toLocalDate(), rs.getDate(5).toLocalDate(), rs.getBigDecimal(6), rs.getBigDecimal(7),
                rs.getBigDecimal(8), rs.getBigDecimal(9), rs.getBigDecimal(10), rs.getBigDecimal(11), rs.getBigDecimal(12), rs.getString(13)));
    }

    @Transactional
    public CommercialDtos.SettlementResponse exportSettlement(long id) {
        int changed = jdbc.update("UPDATE partner_monthly_settlements SET status='EXPORTED', exported_at=CURRENT_TIMESTAMP WHERE id=? AND status='OPEN'", id);
        if (changed == 0) throw new DomainException("SETTLEMENT_NOT_OPEN", "Kỳ công nợ không còn ở trạng thái chờ xuất");
        return jdbc.queryForObject("""
                SELECT s.id, s.partner_id, p.brand_name, s.period_start, s.period_end, s.fixed_rent, s.service_fee,
                       s.actual_revenue, s.commission_rate, s.commission_floor, s.commission_due, s.total_due, s.status
                FROM partner_monthly_settlements s JOIN commercial_partners p ON p.id=s.partner_id WHERE s.id=?
                """, (rs, n) -> new CommercialDtos.SettlementResponse(rs.getLong(1), rs.getString(2), rs.getString(3),
                rs.getDate(4).toLocalDate(), rs.getDate(5).toLocalDate(), rs.getBigDecimal(6), rs.getBigDecimal(7),
                rs.getBigDecimal(8), rs.getBigDecimal(9), rs.getBigDecimal(10), rs.getBigDecimal(11), rs.getBigDecimal(12), rs.getString(13)), id);
    }

    @Transactional
    public CommercialDtos.VoucherResponse issueVoucher(CommercialDtos.VoucherRequest request, String accountId) {
        Long guestId = jdbc.queryForObject("SELECT guest_id FROM customer_accounts WHERE id=?", Long.class, Long.valueOf(accountId));
        if (guestId == null) throw new DomainException("CUSTOMER_NOT_FOUND", "Không tìm thấy tài khoản khách hàng");
        var space = jdbc.queryForMap("SELECT name, zone, floor, access_policy FROM commercial_spaces WHERE id=? AND status='ACTIVE'", request.spaceId());
        String accessPolicy = (String) space.get("access_policy");
        if ("GUEST_ONLY".equals(accessPolicy) && (request.reservationId() == null
                || jdbc.queryForObject("SELECT COUNT(*) FROM reservations WHERE id=? AND guest_id=? AND rental_type='PACKAGE' AND status NOT IN ('CANCELLED','NO_SHOW')", Integer.class, request.reservationId(), guestId) == 0)) {
            throw new DomainException("GUEST_ONLY_ACCESS", "Hồ bơi tầng 21 chỉ dành cho khách thuê phòng theo đêm");
        }
        String tier = jdbc.queryForObject("SELECT membership_tier FROM guests WHERE id=?", String.class, guestId);
        String code = "MAM-" + UUID.randomUUID().toString().replace("-", "").substring(0, 10).toUpperCase();
        jdbc.update("INSERT INTO customer_vouchers (voucher_code, guest_id, space_id, reservation_id, membership_tier, visit_at) VALUES (?, ?, ?, ?, ?, ?)",
                code, guestId, request.spaceId(), request.reservationId(), tier == null ? "STANDARD" : tier, request.visitAt());
        return new CommercialDtos.VoucherResponse(code, (String) space.get("name"), (String) space.get("zone"),
                ((Number) space.get("floor")).intValue(), accessPolicy, tier, request.visitAt(), "ISSUED");
    }

    @Transactional
    public void scanVoucher(String code, CommercialDtos.VoucherScanRequest request, String actor) {
        if (request.revenueAmount() == null || request.revenueAmount().signum() < 0) throw new DomainException("INVALID_REVENUE", "Doanh thu voucher không được âm");
        int updated = jdbc.update("UPDATE customer_vouchers SET status='SCANNED', revenue_amount=?, scanned_at=CURRENT_TIMESTAMP, scanned_by=? WHERE voucher_code=? AND status='ISSUED'", request.revenueAmount(), actor, code);
        if (updated == 0) throw new DomainException("VOUCHER_NOT_SCANNABLE", "Voucher không tồn tại hoặc đã được quét");
        jdbc.update("""
                UPDATE partner_monthly_settlements s
                JOIN customer_vouchers v ON v.space_id IN (SELECT id FROM commercial_spaces WHERE partner_id=s.partner_id)
                JOIN commercial_partners p ON p.id=s.partner_id
                SET s.actual_revenue=(SELECT COALESCE(SUM(v2.revenue_amount),0) FROM customer_vouchers v2 JOIN commercial_spaces cs2 ON cs2.id=v2.space_id WHERE cs2.partner_id=s.partner_id AND v2.scanned_at IS NOT NULL AND DATE(v2.scanned_at) BETWEEN s.period_start AND s.period_end),
                    s.commission_due=GREATEST(s.commission_floor, s.actual_revenue * s.commission_rate / 100),
                    s.total_due=s.fixed_rent+s.service_fee+GREATEST(s.commission_floor, s.actual_revenue * s.commission_rate / 100)
                WHERE v.voucher_code=? AND s.status='OPEN' AND CURRENT_DATE BETWEEN s.period_start AND s.period_end
                """, code);
    }
}
