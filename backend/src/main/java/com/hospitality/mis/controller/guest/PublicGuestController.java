package com.hospitality.mis.controller.guest;

import com.hospitality.mis.dto.guest.PublicGuestDtos;
import com.hospitality.mis.service.guest.PublicGuestPortalService;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;

import java.time.LocalDateTime;
import java.util.List;
import java.util.concurrent.TimeUnit;
import com.hospitality.mis.common.exception.DomainException;

/** API anonymous chỉ đọc cho customer portal, tách khỏi API vận hành nội bộ. */
@RestController
@RequestMapping("/api/public")
public class PublicGuestController {
    private final PublicGuestPortalService service;

    public PublicGuestController(PublicGuestPortalService service) {
        this.service = service;
    }

    @GetMapping("/rooms")
    public ResponseEntity<List<PublicGuestDtos.RoomSummary>> rooms(@RequestParam(name = "type", required = false) String type,
            @RequestParam(name = "page", defaultValue = "0") int page, @RequestParam(name = "size", defaultValue = "20") int size) {
        return cachedPage(service.rooms(type), page, size);
    }

    @GetMapping("/rooms/{roomId}")
    public ResponseEntity<PublicGuestDtos.RoomDetail> room(@PathVariable String roomId) {
        return ResponseEntity.ok().cacheControl(CacheControl.maxAge(30, TimeUnit.SECONDS).cachePublic())
                .body(service.room(roomId));
    }

    @GetMapping("/rooms/availability")
    public ResponseEntity<List<PublicGuestDtos.RoomAvailability>> availability(
            @RequestParam(name = "from") @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime from,
            @RequestParam(name = "to") @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime to,
            @RequestParam(name = "type", required = false) String type,
            @RequestParam(name = "page", defaultValue = "0") int page, @RequestParam(name = "size", defaultValue = "20") int size) {
        List<PublicGuestDtos.RoomAvailability> all = service.availability(from, to, type);
        return noStorePage(all, page, size);
    }

    @GetMapping("/services")
    public ResponseEntity<List<PublicGuestDtos.ServiceSummary>> services(
            @RequestParam(name = "page", defaultValue = "0") int page, @RequestParam(name = "size", defaultValue = "20") int size) {
        return cachedPage(service.services(), page, size);
    }

    private <T> ResponseEntity<List<T>> cachedPage(List<T> source, int page, int size) {
        return page(source, page, size, CacheControl.maxAge(30, TimeUnit.SECONDS).cachePublic());
    }

    private <T> ResponseEntity<List<T>> noStorePage(List<T> source, int page, int size) {
        return page(source, page, size, CacheControl.noStore());
    }

    private <T> ResponseEntity<List<T>> page(List<T> source, int page, int size, CacheControl cacheControl) {
        if (page < 0 || size < 1 || size > 100) {
            throw new DomainException("INVALID_PAGINATION", "page phải >= 0 và size từ 1 đến 100");
        }
        int from = (int) Math.min(source.size(), (long) page * size);
        int to = Math.min(source.size(), from + size);
        return ResponseEntity.ok().cacheControl(cacheControl)
                .header("X-Total-Count", String.valueOf(source.size()))
                .header("X-Page", String.valueOf(page))
                .header("X-Page-Size", String.valueOf(size))
                .body(source.subList(from, to));
    }
}
